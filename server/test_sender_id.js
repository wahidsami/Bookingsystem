const db = require('./src/models');

async function test() {
  const tgs = await db.TenantGiftCardTransaction.findOne({
    order: [['createdAt', 'DESC']]
  });
  console.log('Most recent gift card transaction:');
  console.log(JSON.stringify(tgs, null, 2));
  process.exit(0);
}

test().catch(console.error);
