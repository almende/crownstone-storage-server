// Set options as a parameter, environment variable, or rc file.
// eslint-disable-next-line no-global-assign
require = require('esm')(module/* , options */)
const Express = require('express')
const Influx = require('influx')
const WebSocket = require('ws')

const argv = require('minimist')(process.argv.slice(2), {
  'alias': { 'port': 'p', 'db_hostname': 'h', 'db_name': 'd' },
  'default': { 'port': 3000, 'db_hostname': 'localhost', 'db_name': 'undagrid_debug_log' }
})

// Starting Application information block:
console.log('Starting application:')
console.log('Used command-line options:' + JSON.stringify(argv))

// Input validation:
if (!parseInt(argv['port'])) {
  console.error('Invalid portnumber given:' + argv['port'])
  process.exit()
}

//Init db access:
const influx = new Influx.InfluxDB({
  host: argv['db_hostname'],
  database: argv['db_name']
})

//All is well, starting Express webserver, static content, a REST endpoint and a Websocket endpoint:
const app = Express()
app.use(Express.static('static'))
const api = new Express()
app.use('/api/', api)
const wssa = new Express()
app.use('/ws/', wssa)
const wss = WebSocker.Server({ wssa })

//Configure the REST endpoint
api.use(require('body-parser').json())
api
  .post('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (!req.is('application/json')) {
      // Send error here
      res.status(400).send({ 'result': 'error', 'error': 'Expected application/json contents' })
    } else {
      let measurement = req.body
      if (!measurement['Undagrid Debug Log']) {
        res.status(400).send({
          'result': 'error',
          'error': 'This doesn\'t look like Undagrid Debug Log data to me.'
        })
      } else {
        //forward measurement to influx db
        influx.writePoints([{
          measurement: 'undagrid_debug_log',
          tags: {},
          fields: {
            value: measurement['Value'],
            messageid: measurement['MessageID']
          },
          timestamp: measurement['Timestamp']
        }], { precision: 's' })
          .then(() => {
            let result = { 'result': 'ok' }
            res.send(result)
          }).catch((e) => {
          console.error(e)
          res.status(500).send({ 'result': 'error', 'error': 'Couldn\'t write to database' })
        })
      }
    }
  })

//Configure the Websocket endpoint
wss.on('connection', function connection (ws) {
  ws.on('message', function incoming (message) {
      console.log('received: %s', message)
      try {
        let measurement = JSON.parse(message)
        if (!measurement['Undagrid Debug Log']) {
          ws.send({
            'result': 'error',
            'error': 'This doesn\'t look like Undagrid Debug Log data to me.'
          })
        } else {
          //forward measurement to influx db
          influx.writePoints([{
            measurement: 'undagrid_debug_log',
            tags: {},
            fields: {
              value: measurement['Value'],
              messageid: measurement['MessageID']
            },
            timestamp: measurement['Timestamp']
          }], { precision: 's' })
            .then(() => {
              let result = { 'result': 'ok' }
              ws.send(result)
            }).catch((e) => {
            console.error(e)
            ws.send({ 'result': 'error', 'error': 'Couldn\'t write to database' })
          })
        }
      }
      catch
        (e) {
        console.log('Could not parse json in message: ' + message)
      }
    }
  )
})

//Actually start listening.
app.listen(argv['port'], () => {
  console.log('Server running on port ' + argv['port'])
})
module.exports = require('./main.js')
