const loginUrl = 'http://localhost:3000/api/v1/auth/login';
const providersUrl = 'http://localhost:3000/api/v1/auth/providers';

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
    console.log("Login successful.");

    console.log("Fetching providers...");
    const providersRes = await fetch(providersUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    let providers = await providersRes.json();
    
    if (providers.length === 0) {
      console.log("No providers found. Adding one...");
      await fetch(providersUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Repro GitLab',
          type: 'gitlab',
          url: 'https://gitlab.com',
          token: 'glpat-reprotoken',
          isSource: false
        })
      });
      const refreshRes = await fetch(providersUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      providers = await refreshRes.json();
    }

    if (providers.length === 0) {
      console.error("Failed to add or fetch providers.");
      return;
    }

    const providerId = providers[0].id;
    console.log(`Setting provider ${providerId} as source...`);
    
    const setSourceRes = await fetch(`${providersUrl}/${providerId}/set-source`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (setSourceRes.ok) {
      console.log("Source set successfully!");
      console.log(await setSourceRes.json());
    } else {
      console.error("Failed to set source:", setSourceRes.status, await setSourceRes.text());
    }
  } catch (err) {
    console.error("Error during reproduction:", err);
  }
}

repro();
