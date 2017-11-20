const superagent = require('superagent')

const HORIZON = 'https://horizon.stellar.org'

module.exports = {
  inline,
  chosen
}

function inline (q, reply) {
  if (q.query.length == 56) {
    /******************* ACCOUNT *******************/
    Promise.all([
      superagent.get(HORIZON + `/accounts/${q.query}`),
      superagent.get(HORIZON + `/accounts/${q.query}/operations?order=desc&limit=15`)
    ])
    .then(responses => responses.map(r => r.body))
    .then(([addr, {_embedded: {records: ops}}]) => {          
      reply([
        response(addr.id, `Account ${addr.id}`, 'A Stellar account.', `
*Stellar address* _${addr.id}_

*Balances*:
  ${
  addr.balances.map(b =>
    `${b.asset_type == 'native'
      ? '_lumens_'
      : assetlink(b.asset_code, b.asset_issuer)
     }: ${b.balance}`
  ).join('\n  ')}

*Home domain*: ${addr.home_domain || '-'}
*Inflation destination*: ${
  addr.inflation_destination ? addrlink(addr.inflation_destination) : '-'
}
*Data*: ${'`'}${JSON.stringify(addr.data)}${'`'}
*Operations*:
  - ${ops.map(op => opToText(op)).join('\n  - ')}

[view on Stellar Navigator](https://stellar.debtmoney.xyz/#/addr/${addr.id})
[view on Stellar Explorer](https://steexp.com/account/${addr.id})
[view on Stellar Expert](https://stellar.expert/explorer/account/${addr.id})
[view raw Horizon JSON](https://horizon.stellar.org/accounts/${addr.id})
        `)
      ])
    })
  } else if (q.query.length == 64) {
    /******************* TRANSACTION *******************/
    Promise.all([
      superagent.get(HORIZON + `/transactions/${q.query}`),
      superagent.get(HORIZON + `/transactions/${q.query}/operations?order=desc`),
    ])
    .then(responses => responses.map(r => r.body))
    .then(([txn, {_embedded: {records: ops}}]) => {
      reply([
        response(txn.hash, `Transaction ${txn.hash}`, 'A Stellar transaction.', `
*Stellar transaction* _${txn.hash}_

*Source account*: ${addrlink(txn.source_account)}
*Memo*: ${txn.memo || '-'}
*Fee paid*: ${txn.fee_paid}
*Ledger*: [${txn.ledger}](https://stellar.debtmoney.xyz/#/led/${txn.ledger})
*Last perations* (${txn.operation_count}):
  ${ops.map(op => `[-](https://stellar.debtmoney.xyz/#/op/${op.id}) ` + opToText(op)).join('\n  ')}

[view on Stellar Navigator](https://stellar.debtmoney.xyz/#/txn/${txn.hash})
[view on Stellar Explorer](https://steexp.com/tx/${txn.hash})
[view on Stellar Expert](https://stellar.expert/explorer/tx/${txn.hash})
[view raw Horizon JSON](https://horizon.stellar.org/transactions/${txn.hash})
        `)
      ])
    })
  } else if (parseInt(q.query) > 100000000) {
    /******************* OPERATION *******************/
    Promise.all([
      superagent.get(HORIZON + `/operations/${q.query}`),
      superagent.get(HORIZON + `/operations/${q.query}/effects?order=asc`)
    ])
    .then(responses => responses.map(r => r.body))
    .then(([op, {_embedded: {records: effs}}]) => {
      let txnhash = op._links.transaction.href.split('/').slice(-1)[0]
      
      reply([
        response(op.id, `Operation ${op.id}`, 'A Stellar operation.', `
*Stellar operation* _${op.id}_

${opToText(op)}

*Source account*: ${addrlink(op.source_account)}
*Transaction*: [${wrap(txnhash)}](https://stellar.debtmoney.xyz/#/op/${txnhash})
*Effects*:
  ${effs.map(eff => parseInt(eff.id.split('-')[1]) + ': ' + effToText(eff)).join('\n  ')}
        `)
      ])
    })
  } else if (parseInt(q.query) > 0) {
    /******************* LEDGER *******************/
    Promise.all([
      superagent.get(HORIZON + `/ledgers/${q.query}`),
      superagent.get(HORIZON + `/ledgers/${q.query}/transactions?order=desc`)
    ])
    .then(responses => responses.map(r => r.body))
    .then(([led, {_embedded: {records: txns}}]) => {
      reply([
        response(led.sequence, `Ledger ${led.sequence}`, 'A Stellar ledger.', `
*Stellar ledger* _${led.sequence}_

*Hash*: ${led.hash}
*Time closed*: ${led.closed_at}
*Total coins*: ${led.total_coins}
*Fee pool*: ${led.fee_pool}
*Protocol version*: ${led.protocol_version}
*Base fee*: ${led.base_fee}
*Base reserve*: ${led.base_reserve}
*Operations*: (${led.operation_count})
*Transactions* (${led.transaction_count}):
  ${txns.map(txn => `[-](https://stellar.debtmoney.xyz/#/txn/${txn.hash}) ${txn.hash} (${txn.operation_count} op${txn.operation_count != 1 ? 's' : ''})`).join('\n  ')}
        `)
      ])
    })
  }
}

function chosen (chosen) {
  console.log('chosen', chosen)
}

// helpers

const wrap = (id) => id ? id.slice(0, 3) + '...' + id.slice(-4) : 'UNDEFINED'
const addrlink = (id) => `[${wrap(id)}](https://stellar.debtmoney.xyz/#/addr/${id})`
const assetlink = (code, issuer) => `[${code}#${wrap(issuer)}](https://stellar.expert/explorer/asset/${code}-${issuer}-1)`

function response (id, title, desc, text) {
  return {
    type: 'article',
    id: id,
    title: title,
    input_message_content: {
      message_text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    },
    description: desc
  }
}

function opToText (op) {
  switch (op.type) {
    case 'create_account':
      return `${addrlink(op.funder)} created the account ${addrlink(op.account)} by funding it with ${op.starting_balance}.`
    case 'payment':
      return `${addrlink(op.source_account)} paid ` +
             `${op.amount} ${op.asset_type == 'native' ? '_lumens_' : assetlink(op.asset_code, op.asset_issuer)} ` +
             `to ${addrlink(op.to)}.`
    case 'path_payment':
      return `${addrlink(op.source_account)} paid ` +
             `${op.amount} ${op.asset_type == 'native' ? '_lumens_' : assetlink(op.asset_code, op.asset_issuer)} ` +
             `to ${addrlink(op.to)} through a ${op.path.length}-length path.`
    case 'manage_offer':
      return `${addrlink(op.source_account)} posted an offer to buy ${op.amount} ` +
             `${op.buying_asset_type == 'native' ? '_lumens_' : assetlink(op.buying_asset_code, op.buying_asset_issuer)} ` +
             `for ${op.price} ` +
             `${op.selling_asset_type == 'native' ? '_lumens_' : assetlink(op.selling_asset_code, op.selling_asset_issuer)} ` +
             `each.`
    case 'create_passive_offer':
      return `${addrlink(op.source_account)} posted a passive offer to buy ${op.amount} ` +
             `${op.buying_asset_type == 'native' ? '_lumens_' : assetlink(op.buying_asset_code, op.buying_asset_issuer)} ` +
             `for ${op.price} ` +
             `${op.selling_asset_type == 'native' ? '_lumens_' : assetlink(op.selling_asset_code, op.selling_asset_issuer)} ` +
             `each.`
    case 'set_options':
      return `${addrlink(op.source_account)} set options: ${'`'}${JSON.stringify({
        inflation_dest: op.inflation_dest,
        home_domain: op.home_domain,
        signer_key: op.signer_key,
        signer_weight: op.signer_weight,
        master_key_weight: op.master_key_weight,
        low_threshold: op.low_threshold,
        med_threshold: op.med_threshold,
        high_threshold: op.high_threshold
      })}${'`'}.`
    case 'change_trust':
      return `${addrlink(op.trustor)} trusted ${assetlink(op.asset_code, op.asset_issuer)} to a limit of ${op.limit}.`
    case 'allow_trust':
      return `${addrlink(op.trustee)} ${op.authorize ? '' : 'dis'}allowed ${addrlink(op.trustor)} to trust ${assetlink(op.asset_code, op.asset_issuer)}.`
    case 'account_merge':
      return `${wrap(op.account)} merged into ${addrlink(op.into)}.`
    case 'inflation':
      return `${addrlink(op.source_account)} called inflation.`
    case 'manage_data':
      return `${addrlink(op.source_account)} set data key ${'`'}${op.name}${'`'} to ${'`'}${op.value}${'`'}.`
  }
}

function effToText (eff) {
  var base = `${addrlink(eff.account)}: ${'`'}${eff.type}${'`'}`
  var append = null
  switch (eff.type) {
    case 'account_created':
      append = eff.starting_balance
      break
    case 'account_removed':
      break
    case 'account_credited':
    case 'account_debited':
      append = eff.amount
      break
    case 'account_thresholds_updated':
      append = `low: ${eff.low_threshold}, med: ${eff.med_threshold}, high: ${eff.highthreshold}`
      break
    case 'account_home_domain_updated':
      append = eff.home_domain
      break
    case 'account_flags_updated':
      append = `auth ${eff.auth_required ? '' : 'not '}required and ${eff.auth_revokable ? '' : 'un'}revokable`
      break
    case 'signer_created':
    case 'signer_removed':
    case 'signer_updated':
      append = `${eff.key}, weight: ${eff.weight}`
      break
    case 'trustline_created':
    case 'trustline_removed':
    case 'trustline_updated':
      append = `${assetlink(eff.asset_code, eff.asset_issuer)} to a limit of ${eff.limit}`
      break
    case 'trustline_authorized':
    case 'trustline_deauthorized':
      append = `${assetlink(eff.asset_code, eff.asset_issuer)} to ${addrlink(eff.trustor)}`
      break
    case 'offer_created':
    case 'offer_removed':
    case 'offer_updated':
      break
    case 'trade':
      append = `given ${eff.sold_amount} ${eff.sold_asset_type == 'native' ? '_lumens_' : assetlink(eff.sold_asset_code, eff.sold_asset_issuer)} ` +
               `to ${addrlink(eff.seller)} in exchnage for ` +
               `${eff.bought_amount} ${eff.bought_asset_type == 'native' ? '_lumens_' : assetlink(eff.bought_asset_code, eff.bought_asset_issuer)} `
      break
    case 'data_created':
    case 'data_removed':
    case 'data_updated':
      break
  }
  return base + (append ? ' ' + append : '') + '.'
}