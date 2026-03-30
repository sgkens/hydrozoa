const loginUrl = 'http://localhost:3000/api/v1/auth/login';
const providerUrl = 'http://localhost:3000/api/v1/auth/providers';

async function repro() {
  try {
    console.log("Logging in...");
    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hydrozoa.io', password: 'hydrozoa-default' })
    });
    
    if (!loginRes.ok) {
      console.error("Login failed:", await loginRes.text());
      return;
    }
    
    const { token } = await loginRes.json();
    console.log("Login successful, token obtained.");

    console.log("Adding provider...");
    const providerRes = await fetch(providerUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Test GitLab',
        type: 'gitlab',
        url: 'https://gitlab.com',
        token: 'glpat-1234567890abcdef',
        isSource: false
      })
    });

    if (providerRes.ok) {
      console.log("Provider added successfully!");
      console.log(await providerRes.json());
    } else {
      console.error("Failed to add provider:", providerRes.status, await providerRes.text());
    }
  } catch (err) {
    console.error("Error during reproduction:", err);
  }
}

repro();
