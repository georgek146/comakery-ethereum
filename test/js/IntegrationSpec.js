import './testHelper'
import {keys} from 'lodash'
import chai, {expect} from 'chai'
import chaiHttp from 'chai-http'
import {d, type} from 'lightsaber'
import sinon from 'sinon'

const server = require('../../lib/server')
const Token = require('../../lib/token')

chai.use(chaiHttp)

describe('API', () => {
  beforeEach('', () => {
    process.env.API_KEY_WHITELIST = 'aaa,bbb'
  })

  describe('POST /project', () => {
    it('should return a contract address', (done) => {
      let token = sinon.mock(Token)
      token.expects('uploadSource').once()

      chai
      .request(server)
      .post('/project')
      .send({ maxSupply: 101, apiKey: 'aaa' })
      .then(function (res) {
        expect(res).to.have.status(200)
        const {body} = res
        expect(keys(body)).to.deep.equal(['contractAddress'])
        const {contractAddress} = body

        expect(contractAddress).to.match(/^0x[0-9a-f]{40}$/)
        const tokenContract = Token.loadContract(contractAddress)
        return tokenContract.maxSupply.call()
      }).then((maxSupply) => {
        expect(maxSupply.toNumber()).to.eq(101)
        token.verify()
        token.restore()
      }).then(done).catch(done)
    })

    it('should fail if no maxSupply sent', (done) => {
      chai
      .request(server)
      .post('/project')
      .send({ apiKey: 'aaa' })
      .then(() => {
        throw new Error('expected server 500 error, but none was thrown')
      }).catch(function (error) {
        expect(type(error.response)).to.equal('object', error.message)
        expect(error.response.status).to.equal(500)
        expect(error.response.text).to.match(/maxSupply required but not found/)
      })
      .then(done)
      .catch(done)
    })

    it('should return 404 if security token not in whitelist', (done) => {
      chai
      .request(server)
      .post('/project')
      .send({ maxSupply: 101, apiKey: 'not a key in our whitelist' })
      .then(() => {
        throw new Error('expected server 404 error, but none was thrown')
      }).catch(function (error) {
        expect(type(error.response)).to.equal('object', error.message)
        expect(error.response.status).to.equal(403)
        expect(error.response.text).to.match(/API key not found/)
      })
      .then(done).catch(done)
    })
  })

  describe('POST /token_issue', () => {
    it('should return a transaction address', (done) => {
      const contractAddress = Token.deployContract()
      const recipient = '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'  // pubkey of private key 0x0000000000000000000000000000000000000000000000000000000000000002
      chai
      .request(server)
      .post('/token_issue')
      .send({ contractAddress, recipient, amount: 111, apiKey: 'aaa' })
      .then(function (res) {
        expect(res).to.have.status(200)
        const {body} = res
        expect(keys(body)).to.deep.equal(['transactionId'])
        expect(body.transactionId).to.match(/^0x[0-9a-f]{64}$/)

        const tokenContract = Token.loadContract(contractAddress)
        return tokenContract.balanceOf.call(recipient)
      }).then((balanceOf) => {
        expect(balanceOf.toNumber()).to.eq(111)
      }).then(done).catch(done)
    })

    it('should fail if missing params', (done) => {
      const contractAddress = Token.deployContract()
      const recipient = '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'  // pubkey of private key 0x0000000000000000000000000000000000000000000000000000000000000002
      chai
      .request(server)
      .post('/token_issue')
      .send({ contractAddress, recipient, apiKey: 'aaa' })
      .then(() => {
        throw new Error(
          'hey no error was thrown and I thought it would be'
        )
      })
      .catch(function (res) {
        expect(res).to.have.status(500)
        const {response: {text}} = res
        expect(text).to.match(/amount.*is not a positive integer/)
      }).then(() => {
        const tokenContract = Token.loadContract(contractAddress)
        return tokenContract.balanceOf.call(recipient)
      }).then((balanceOf) => {
        expect(balanceOf.toNumber()).to.eq(0)
      }).then(done).catch(done)
    })
  })
})

/* Declare global variables for eslint to ignore: */
/* global describe */
/* global it */
/* global beforeEach */