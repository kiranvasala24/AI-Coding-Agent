
/**
 * Rate Limit Tester
 * 
 * Verifies that the rate limiter correctly blocks requests after the limit is reached.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const API_URL = `${SUPABASE_URL}/functions/v1/runs`;

async function testRateLimit() {
    if (!SUPABASE_URL || !ANON_KEY) {
        console.error("Missing environment variables VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
        process.exit(1);
    }

    console.log(`Testing rate limit at: ${API_URL}`);

    const results = [];
    const MAX_ATTEMPTS = 15; // Limit is 10/min

    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
        process.stdout.write(`Attempt ${i}/${MAX_ATTEMPTS}... `);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`
                },
                body: JSON.stringify({
                    task: `Rate limit test task ${i} during final deploy verification`
                })
            });

            const status = response.status;
            const remaining = response.headers.get('X-RateLimit-Remaining');
            const limit = response.headers.get('X-RateLimit-Limit');
            const reset = response.headers.get('Retry-After');

            console.log(`Status: ${status}, Remaining: ${remaining}/${limit}, Retry-After: ${reset || 'N/A'}`);

            results.push({ i, status, remaining });

            if (status === 429) {
                console.log("✅ Successfully hit rate limit!");
            }
        } catch (error) {
            console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    const blocked = results.filter(r => r.status === 429);
    if (blocked.length > 0) {
        console.log(`\nVerification PASSED: Blocked ${blocked.length} requests after limit.`);
    } else {
        console.log(`\nVerification FAILED: Did not hit rate limit after ${MAX_ATTEMPTS} requests.`);
    }
}

testRateLimit();
