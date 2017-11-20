const superagent = require('superagent')

const app = require('express')()
app.use(require('body-parser').json())

const bot = require('./bot')
const URL = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`

superagent.post(URL + '/setWebhook', {url: 'https://stellar-bot.glitch.me/webhook'})
  .then(r => console.log(r.text))
  .catch(e => console.log(e.response.text))

app.post('/webhook', (r, w) => {
  w.status(200).end()

  if (r.body && r.body.inline_query) {
    bot.inline(r.body.inline_query, function (results) {
      superagent.post(URL + '/answerInlineQuery', {
        inline_query_id: r.body.inline_query.id,
        results: results,
        // cache_time: 31536000,
      }).then(res => console.log(res.text)).catch(e => console.log(e.response.text))
    })
  } else if (r.body && r.body.chosen_inline_result) {
    bot.chosen(r.body.chosen_inline_result)
  }
})

console.log('listening')
app.listen(process.env.PORT)