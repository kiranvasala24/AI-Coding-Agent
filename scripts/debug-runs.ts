import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function debugRuns() {
    console.log("Fetching all runs...");
    const { data, error } = await supabase.from("runs").select("id, task, status");
    if (error) {
        console.error("Error fetching runs:", error);
    } else {
        console.log("Runs found:", data.length);
        data.forEach(r => console.log(`- ${r.id}: ${r.task} (${r.status})`));
    }
}

debugRuns();
