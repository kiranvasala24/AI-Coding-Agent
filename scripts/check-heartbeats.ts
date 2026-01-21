import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function checkHeartbeats() {
    console.log("Checking latest heartbeats...");
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

    const { data, error } = await supabase
        .from("run_events")
        .select("created_at, payload")
        .eq("event_type", "RUNNER_HEARTBEAT")
        .gte("created_at", thirtySecondsAgo)
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching heartbeats:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log(`Found ${data.length} recent heartbeats.`);
        data.forEach((h, i) => {
            console.log(`${i + 1}: Created at ${h.created_at}, RunnerID: ${h.payload.runnerId}`);
        });
    } else {
        console.log("No recent heartbeats found in DB.");

        // Check all heartbeats to see if any exist
        const { data: all } = await supabase
            .from("run_events")
            .select("created_at")
            .eq("event_type", "RUNNER_HEARTBEAT")
            .order("created_at", { ascending: false })
            .limit(1);

        if (all && all.length > 0) {
            console.log(`Most recent heartbeat was at: ${all[0].created_at}`);
        } else {
            console.log("No heartbeats ever found.");
        }
    }
}

checkHeartbeats();
