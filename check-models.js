async function Models() {
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const names = data.models.map(m => m.name);
    console.log(names);
  } catch (error) {
    console.error("Error:", error);
  }
}

Models();
