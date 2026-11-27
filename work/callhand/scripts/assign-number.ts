// Operator tool: give a business its Callhand phone number.
//
//   npm run assign-number -- <business-id> <phone-number>
//   npm run assign-number -- <business-id> --remove <phone-number>
//
// Numbers are assigned here (not by owners in the dashboard) so no business
// can claim a number and receive another business's calls. Buy the number in
// Twilio first and point its voice webhook at <APP_URL>/twilio/voice (POST).
import { serviceDb } from '../server/db';
import { toE164 } from '../shared/phone';

async function main() {
  const [businessId, ...rest] = process.argv.slice(2);
  const remove = rest[0] === '--remove';
  const number = toE164(remove ? rest[1] : rest[0]);
  if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId) || !number) {
    console.error('Usage: npm run assign-number -- <business-id> [--remove] <phone-number>');
    process.exit(2);
  }
  const db = serviceDb();
  const { data: business, error: businessError } = await db.from('businesses').select('id,name').eq('id', businessId).maybeSingle();
  if (businessError || !business) {
    console.error('No business with that id.');
    process.exit(1);
  }
  if (remove) {
    const { error } = await db.from('phone_numbers').update({ active: false }).eq('business_id', businessId).eq('phone_number', number);
    if (error) throw error;
    console.log(`${number} is no longer answered for ${business.name}.`);
    return;
  }
  const { data: existing } = await db.from('phone_numbers').select('business_id').eq('phone_number', number).maybeSingle();
  if (existing && existing.business_id !== businessId) {
    console.error(`${number} already belongs to another business. Remove it there first.`);
    process.exit(1);
  }
  const { error } = await db.from('phone_numbers').upsert({ business_id: businessId, phone_number: number, active: true }, { onConflict: 'phone_number' });
  if (error) throw error;
  console.log(`${number} now answers for ${business.name}.`);
}

main().catch((error) => {
  console.error(String(error?.message ?? error));
  process.exit(1);
});
