// Set options as a parameter, environment variable, or rc file.
// eslint-disable-next-line no-global-assign
require = require('esm')(module/* , options */)
const Express = require('express')
const Influx = require('influx')

const argv = require('minimist')(process.argv.slice(2), {
  'alias': { 'port': 'p', 'db_hostname': 'h', 'db_name': 'd' },
  'default': { 'port': 3000, 'db_hostname': 'localhost', 'db_name': 'crownstone' }
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

//All is well, starting:
const app = Express()
const api = new Express()
app.use(Express.static('static'))
app.use(require('body-parser').json())

api
  .post('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (!req.is('application/json')) {
      // Send error here
      res.status(400).send({ 'result': 'error', 'error': 'Expected application/json contents' })
    } else {
      let points = []
      let measurements = []

      let measurement = req.body
      if (Array.isArray(measurement)) {
        measurements = measurements.concat(measurement)
      } else {
        measurements.push(measurement)
      }
      console.log(measurements)
      measurements.map((item) => {
        if (typeof item['Timestamp'] !== 'undefined') {
          if (typeof item['Amps'] !== 'undefined') {
            points.push({
              measurement: 'amps',
              tags: {},
              fields: {
                amps: item['Amps']
              },
              timestamp: item['Timestamp']
            })
          }
          if (typeof item['Volts'] !== 'undefined') {
            points.push({
              measurement: 'volts',
              tags: {},
              fields: {
                volts: item['Volts']
              },
              timestamp: item['Timestamp']
            })
          }
        } else {
          console.log('Measurement missed Timestamp.', item)
        }
      })
      if (points.length === 0) {
        res.status(400).send({
          'result': 'error',
          'error': 'This doesn\'t look like Crownstone data to me, missing Amps or Volts'
        })
      } else {
        //forward measurement to influx db
        influx.writePoints(points)
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
app.use('/api/', api)

app.listen(argv['port'], () => {
  console.log('Server running on port ' + argv['port'])
})

module.exports = require('./main.js')
