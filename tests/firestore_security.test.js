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
    'chat_data'
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
