import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function testInsert() {
    const systemId = "00000000-0000-0000-0000-000000000000";
    console.log("Testing insert into run_events...");
    const { error } = await supabase.from("run_events").insert({
        run_id: systemId,
        event_type: "DEBUG_EVENT",
        payload: { test: true }
    });

    if (error) {
        console.error("Insert failed:", error);
    } else {
        console.log("Insert successful!");
    }
}

testInsert();
