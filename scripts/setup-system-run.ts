import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function setupSystem() {
    const systemId = "00000000-0000-0000-0000-000000000000";

    console.log("Checking for system run...");
    const { data, error } = await supabase
        .from("runs")
        .select("id")
        .eq("id", systemId)
        .maybeSingle();

    if (error) {
        console.error("Error checking system run:", error);
        process.exit(1);
    }

    if (data) {
        console.log("System run already exists.");
    } else {
        console.log("Creating system run...");
        const { error: insertError } = await supabase
            .from("runs")
            .insert({
                id: systemId,
                task: "System Runner",
                status: "completed",
                approval: { required: false },
            });

        if (insertError) {
            console.error("Error creating system run:", insertError);
            process.exit(1);
        }
        console.log("System run created successfully!");
    }
}

setupSystem();
