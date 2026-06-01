// One-shot VAPID key generator. Run once and paste the keys into .env.local
// and into the supabase function secret (VAPID_PRIVATE_KEY).
//
//   node scripts/gen-vapid.mjs

import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()
console.log()
console.log('Paste this into .env.local (and .env.example for reference):')
console.log()
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}`)
console.log()
console.log('Set this as a Supabase Edge Function secret (server-side only, never bundle):')
console.log()
console.log(`supabase secrets set VAPID_PRIVATE_KEY=${privateKey} --project-ref rgqrbfgwhzoxavmheckj`)
console.log(`supabase secrets set VAPID_PUBLIC_KEY=${publicKey} --project-ref rgqrbfgwhzoxavmheckj`)
console.log(`supabase secrets set VAPID_SUBJECT=mailto:you@example.com --project-ref rgqrbfgwhzoxavmheckj`)
console.log()
