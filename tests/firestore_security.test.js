// tests/firestore_security.test.js
// Static AST & security rule invariant verification suite for firestore.rules

import assert from 'assert';
import fs from 'fs';
import path from 'path';

function runFirestoreRuleSecurityTests() {
  console.log('\n🔒 Starting Firestore Security Rules Invariant Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  const rulesContent = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');

  // --- CRITICAL VULNERABILITY 1: Token Leak & Recursive Match ---
  test('RULES-01: No recursive wildcard match /{document=**} exists under users/{userId}', () => {
    // Find the users/{userId} block
    const userBlockMatch = rulesContent.match(/match\s+\/users\/\{userId\}\s*\{([\s\S]*)/);
    assert(userBlockMatch, 'match /users/{userId} block must exist');
    const userBlock = userBlockMatch[1];
    
    // Check that there is NO recursive allow rule like `match /{document=**} { allow ...`
    const dangerousRecursiveAllow = /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read[^{]*true/i.test(userBlock) ||
                                    /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write\s*:\s*if\s+isWhitelisted/i.test(userBlock);
    assert(!dangerousRecursiveAllow, 'Dangerous recursive wildcard allow rule must NOT exist in users/{userId}');
  });

  test('RULES-02: Isolated server_tokens collection exists and is completely forbidden to clients', () => {
    assert(rulesContent.includes('match /server_tokens/{userId}'), 'server_tokens collection must be defined');
    const serverTokensBlock = rulesContent.match(/match\s+\/server_tokens\/\{userId\}\s*\{\s*allow\s+read,\s*write\s*:\s*if\s+false;\s*\}/);
    assert(serverTokensBlock, 'server_tokens must enforce: allow read, write: if false;');
  });

  test('RULES-03: Legacy tokens subcollection is explicitly forbidden to clients', () => {
    const legacyTokenBlock = rulesContent.match(/match\s+\/tokens\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write\s*:\s*if\s+false;\s*\}/);
    assert(legacyTokenBlock, 'users/{userId}/tokens must enforce: allow read, write: if false;');
  });

  test('RULES-04: Direct access to root user document /users/{userId} is forbidden', () => {
    const userDocRule = rulesContent.match(/match\s+\/users\/\{userId\}\s*\{\s*\/\/[^\n]*\s*allow\s+read,\s*write\s*:\s*if\s+false;\s*/);
    assert(userDocRule, 'users/{userId} root document must enforce: allow read, write: if false;');
  });

  // --- WHITELIST & VERIFICATION DEFENSE ---
  test('RULES-05: Whitelist collection denies all client writes', () => {
    const whitelistMatch = rulesContent.match(/match\s+\/whitelist\/\{email\}\s*\{([\s\S]*?)\}/);
    assert(whitelistMatch, 'whitelist collection must be defined');
    assert(whitelistMatch[1].includes('allow write: if false;'), 'whitelist must forbid client writes');
  });

  test('RULES-06: isWhitelisted helper requires email_verified or google provider', () => {
    assert(rulesContent.includes('request.auth.token.email_verified == true'), 'isWhitelisted must check email_verified == true');
    assert(rulesContent.includes('request.auth.token.email.lower()'), 'isWhitelisted must normalize email to lower case');
  });

  // --- SCHEMA & TYPE VALIDATION INVARIANTS ---
  const requiredSubcollections = [
    'projects',
    'reminders',
    'inboxItems',
    'categories',
    'reminderCategories',
    'chat_data',
    'gymExercises',
    'gymPlans',
    'gymWorkouts',
    'gymBody'
  ];

  requiredSubcollections.forEach(col => {
    test(`RULES-SCHEMA: Subcollection '${col}' is explicitly defined with isOwner protection`, () => {
      assert(rulesContent.includes(`match /${col}/`), `Subcollection ${col} must be explicitly matched`);
      const colRegex = new RegExp(`match\\s+\\/${col}\\/\\{[^}]+\\}\\s*\\{([\\s\\S]*?)(?:\\n\\s*\\/\\/|\\n\\s*\\}\\s*\\})`);
      const match = rulesContent.match(colRegex);
      assert(match, `Could not parse block for ${col}`);
      assert(match[1].includes('isOwner(userId)'), `${col} must enforce isOwner(userId)`);
    });
  });

  test('RULES-VALIDATION: projects enforces hasOnly, string length and progress limits', () => {
    const projMatch = rulesContent.match(/match\s+\/projects\/\{projectId\}\s*\{([\s\S]*?)\n\s*\}/);
    assert(projMatch, 'projects match block must exist');
    const content = projMatch[1];
    assert(content.includes('hasAll([\'id\', \'title\'])'), 'projects must require id and title');
    assert(content.includes('hasOnly('), 'projects must whitelist allowed fields via hasOnly');
    assert(content.includes('title.size() <= 200'), 'projects must limit title length');
    assert(content.includes('progress >= 0 && request.resource.data.progress <= 100'), 'projects must validate progress percentage');
    assert(content.includes('request.resource.data.id == resource.data.id'), 'projects update must enforce immutable id');
  });

  test('RULES-VALIDATION: reminders enforces hasOnly, completed bool and notes limit', () => {
    const remMatch = rulesContent.match(/match\s+\/reminders\/\{reminderId\}\s*\{([\s\S]*?)\n\s*\}/);
    assert(remMatch, 'reminders match block must exist');
    const content = remMatch[1];
    assert(content.includes('hasAll([\'id\', \'title\'])'), 'reminders must require id and title');
    assert(content.includes('completed is bool'), 'reminders must validate completed boolean type');
    assert(content.includes('request.resource.data.id == resource.data.id'), 'reminders update must enforce immutable id');
    assert(content.includes("'isCalendarSynced', 'googleEventId'"), 'reminders must whitelist calendar sync fields');
    assert(content.includes("request.resource.data.isCalendarSynced is bool"), 'reminders must validate calendar sync flag');
    assert(content.includes("request.resource.data.googleEventId == null || request.resource.data.googleEventId is string"), 'reminders must validate Google event id');
  });

  test('RULES-VALIDATION: reminders whitelist and type-check the task fields kind, quick and parked (create and update)', () => {
    const remMatch = rulesContent.match(/match\s+\/reminders\/\{reminderId\}\s*\{([\s\S]*?)\n\s*\}/);
    assert(remMatch, 'reminders match block must exist');
    const content = remMatch[1];
    const whitelist = content.match(/'recurrence', 'lastCompletedAt', 'kind', 'quick', 'parked'/g) || [];
    assert.strictEqual(whitelist.length, 2, 'kind, quick and parked must be whitelisted for create and update');
    const kindChecks = content.match(/request\.resource\.data\.kind in \['abgabe', 'pruefung'\]/g) || [];
    assert.strictEqual(kindChecks.length, 2, 'kind must be restricted to abgabe or pruefung for create and update');
    assert.strictEqual((content.match(/request\.resource\.data\.quick is bool/g) || []).length, 2, 'quick must be a bool');
    assert.strictEqual((content.match(/request\.resource\.data\.parked is bool/g) || []).length, 2, 'parked must be a bool');
  });

  test('RULES-VALIDATION: projects, reminders and inboxItems whitelist environmentId and restrict it to the known environments', () => {
    const checks = rulesContent.match(/request\.resource\.data\.environmentId in \['hochschule', 'arbeit', 'gym'\]/g) || [];
    assert.strictEqual(checks.length, 6, 'environmentId must be validated for create and update of projects, reminders and inboxItems');
    const whitelisted = rulesContent.match(/'environmentId'(?:, 'type', 'exam', 'hints')?\s*\]\)/g) || [];
    assert.strictEqual(whitelisted.length, 6, 'environmentId must be in the hasOnly list for create and update of projects, reminders and inboxItems');
    assert(!rulesContent.includes("environmentId in ['allgemein'"), 'allgemein is the default and must never be stored');
  });

  test('RULES-VALIDATION: projects whitelist and type-check the Fach fields type, exam and hints (create and update)', () => {
    assert.strictEqual((rulesContent.match(/'environmentId', 'type', 'exam', 'hints'/g) || []).length, 2, 'type, exam and hints must be whitelisted for create and update');
    assert.strictEqual((rulesContent.match(/request\.resource\.data\.type == 'fach'/g) || []).length, 2, 'type must be restricted to fach');
    assert.strictEqual((rulesContent.match(/request\.resource\.data\.exam is map && request\.resource\.data\.exam\.size\(\) <= 2/g) || []).length, 2, 'exam must be a small map');
    assert.strictEqual((rulesContent.match(/request\.resource\.data\.hints is list && request\.resource\.data\.hints\.size\(\) <= 200/g) || []).length, 2, 'hints must be a list of at most 200 entries');
  });

  test('RULES-VALIDATION: gym collections whitelist their fields and bound sizes and types', () => {
    // Block einer Sammlung: vom ersten match bis zum nächsten match (oder Dateiende)
    const block = (name) => {
      const start = rulesContent.indexOf('match /' + name + '/');
      assert(start >= 0, name + ' must exist');
      const next = rulesContent.indexOf('match /', start + 10);
      return rulesContent.slice(start, next === -1 ? undefined : next);
    };
    const exercises = block('gymExercises');
    assert(exercises.includes('name.size() <= 100') && exercises.includes('hasOnly'), 'gymExercises must cap name length and whitelist fields');
    assert(exercises.includes("'settings'") && exercises.includes('settings.size() <= 8'), 'gymExercises must whitelist and cap settings');
    assert(block('gymPlans').includes('exerciseIds.size() <= 40'), 'gymPlans must cap the number of exercises');
    const workouts = block('gymWorkouts');
    assert(workouts.includes("'setups'") && workouts.includes('setups.size() <= 40'), 'gymWorkouts must whitelist and cap setups');
    assert(workouts.includes('sets.size() <= 300') && workouts.includes('date.size() == 10'), 'gymWorkouts must cap sets and require an ISO date');
    assert(workouts.includes('startedAt is number') && workouts.includes('endedAt is number'), 'gymWorkouts must type-check timestamps');
    const body = block('gymBody');
    assert(body.includes('weight is number') && body.includes('weight > 0') && body.includes('weight < 1000'), 'gymBody must bound the body weight');
    ['gymExercises', 'gymPlans', 'gymWorkouts', 'gymBody'].forEach((c) => assert(block(c).includes('isOwner(userId)'), c + ' must enforce isOwner'));
  });

  test('RULES-VALIDATION: inboxItems enforces summary and originalText size boundaries', () => {
    const inboxMatch = rulesContent.match(/match\s+\/inboxItems\/\{itemId\}\s*\{([\s\S]*?)\n\s*\}/);
    assert(inboxMatch, 'inboxItems match block must exist');
    const content = inboxMatch[1];
    assert(content.includes('originalText.size() <= 50000'), 'inboxItems must cap originalText length');
    assert(content.includes('summary.size() <= 10000'), 'inboxItems must cap summary length');
  });

  test('RULES-VALIDATION: categories enforces order number and name length limit', () => {
    const catMatch = rulesContent.match(/match\s+\/categories\/\{categoryId\}\s*\{([\s\S]*?)\n\s*\}/);
    assert(catMatch, 'categories match block must exist');
    const content = catMatch[1];
    assert(content.includes('name.size() <= 100'), 'categories must cap name length');
    assert(content.includes('order is number'), 'categories must validate order number type');
  });

  console.log(`\n=======================================================`);
  console.log(`Firestore Rules Tests: ${passed} passed, ${failed} failed`);
  console.log(`=======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runFirestoreRuleSecurityTests();
