async function testEndpoints() {
    const url = "https://htltgvowrzvdnpmbxufu.supabase.co/functions/v1";
    const apiKey = "sb_publishable_zzojJXiFXKB1aJGgHSBTcQ_7brW8hDw";

    const endpoints = ["admin/ping", "runner/heartbeat", "runs", "patches"];

    for (const endpoint of endpoints) {
        try {
            console.log(`Pinging ${endpoint}...`);
            const response = await fetch(`${url}/${endpoint}`, {
                method: endpoint.includes("ping") ? "GET" : "OPTIONS",
                headers: {
                    "apikey": apiKey,
                    "Content-Type": "application/json"
                }
            });
            console.log(`${endpoint}: ${response.status} ${response.statusText}`);
            if (response.status === 200) {
                const text = await response.text();
                console.log(`Response: ${text.slice(0, 100)}`);
            }
        } catch (e) {
            console.error(`Failed to ping ${endpoint}:`, e.message);
        }
    }
}

testEndpoints();
