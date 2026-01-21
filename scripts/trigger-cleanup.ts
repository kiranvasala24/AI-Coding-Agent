
/**
 * Manual Cleanup Trigger
 * 
 * Triggers the admin cleanup endpoint and displays the summary.
 */

async function triggerCleanup() {
    const url = process.env.SUPABASE_URL;
    const token = process.env.ADMIN_TOKEN;
    const days = process.env.RETENTION_DAYS || "7";

    if (!url || !token) {
        console.error("Missing environment variables SUPABASE_URL or ADMIN_TOKEN");
        process.exit(1);
    }

    const endpoint = `${url}/functions/v1/admin/cleanup`;
    console.log(`Triggering cleanup for ${endpoint} (retention: ${days} days)...`);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': token
            },
            body: JSON.stringify({ retentionDays: parseInt(days) })
        });

        const data = await response.json();

        if (response.ok) {
            console.log("\n✅ Cleanup successful!");
            console.table(data.deleted);
            console.log(`\nRemaining: ${data.remaining.runs} runs (Oldest: ${data.remaining.oldestRunDate || 'None'})`);
            console.log(`\nSummary: ${data.summary}`);
        } else {
            console.error(`\n❌ Cleanup failed: ${data.error}`);
        }
    } catch (error: any) {
        console.error(`\n❌ Network error: ${error.message}`);
    }
}

triggerCleanup();
