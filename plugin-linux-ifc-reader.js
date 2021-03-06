let readerMap = {}
let listReaderMap = {}
let writerMap = {}

const IFC = '/openconfig-interfaces:interfaces/interface'
async function ifcReader(path, cli) {
  let cliResponse = await cli.executeRead("ip link show")
  let matches = [...cliResponse.matchAll(/(\d+):\s+([^@:]+).*/g)].map(x => {
    let rObj = {}
    rObj['name'] = x[2]
    return rObj
  });

  return matches
}
listReaderMap[IFC] = ifcReader

const IFC_CFG = '/openconfig-interfaces:interfaces/interface/config'
async function readerIfcCfg(path, cli) {
  let ifcName = path.match(/name='(.+)'/)[1];
  let cliResponse = await cli.executeRead("ip link show " + ifcName)

  let enabled = cliResponse.match(/<.*,.*(UP|DOWN).*>/)[1] === "UP"
  let mtu = parseInt(cliResponse.match(/mtu (\d+)/)[1])

  let model = {}
  model['name'] = ifcName
  model['enabled'] = enabled
  model['mtu'] = mtu > 65535 ? 65535 : mtu

  return model
}
readerMap[IFC_CFG] = readerIfcCfg

const IFC_STATE = '/openconfig-interfaces:interfaces/interface/state'
async function readerIfcState(path, cli) {
  let ifcName = path.match(/name='(.+)'/)[1];
  let cliResponse = await cli.executeRead("ip link show " + ifcName)

  let model = {}
  model['name'] = ifcName

  return model
}
readerMap[IFC_STATE] = readerIfcState

let deviceType = {device:'ubnt', version: '*'}
let endpoint = '0.0.0.0:50051'
// TODO externalize code below, remove global variables
let mergedReaderMap = {...readerMap, ...listReaderMap}
async function reader(path, cli) {
  let unkeyed = path.replace(/\[[^\]]+\]/g, '')
  let fx = mergedReaderMap[unkeyed]
  if (typeof fx != 'function') {
    throw 'No function registered on ' + unkeyed
  }
  console.log("Routing path ", path, "unkeyed", unkeyed, "to", fx)

  return await fx(path, cli)
}

// PluginRegistration.proto::GetCapabilities rpc
function getCapabilities(call, callback) {
  let registeredReaders = []
  for (let path in readerMap) {
    registeredReaders.push({path: path})
  }
  let registeredListReaders = []
  for (let path in listReaderMap) {
    registeredListReaders.push({path: path})
  }
  let response = {deviceType: deviceType, readers: registeredReaders, listReaders: registeredListReaders};
  console.log("getCapabilities request", call.request, "response", response)
  callback(null, response)
}

let PROTO_PATH = __dirname + "/proto/"
let grpc = require("grpc")
let readerPluginService = grpc.load(PROTO_PATH + "ReaderPlugin.proto").devmand.channels.cli.plugin.ReaderPlugin
let pluginRegistrationService = grpc.load(PROTO_PATH + "PluginRegistration.proto").devmand.channels.cli.plugin.PluginRegistration
// utils start
let sending = function(obj){console.log("Sending", obj); return obj;}
// utils end

// ReaderPlugin.proto::Read rpc
function read(call) {
  console.log("read started")
  let currentCliPromise = null

  let executeRead = async function(cmd) {
    console.log("executeRead", cmd)
    if (currentCliPromise) {
      throw "Expected empty currentCliPromise"
    }
    let p = new Promise((resolve, reject) => {
      currentCliPromise = {
        resolve: resolve,
        reject: reject
      }
    })
    call.write(sending({cliRequest:{cmd:cmd}}))
    return p
  }
  let cli =  {"executeRead": executeRead}
  let started = false

  call.on('data', function(readRequest) {
    console.log(readRequest)
    if (!started) {
      if (!readRequest.actualReadRequest) {
        call.end()
        throw "Expected actualReadRequest"
      }
      started = true
      // start reader
      reader(readRequest.actualReadRequest.path, cli).then(function(responseJSON) {
        // send final response back to framework
        if (typeof responseJSON === 'object') {
          responseJSON = JSON.stringify(responseJSON)
        }
        call.write(sending({actualReadResponse:{json:responseJSON}}))
        call.end()
      }, function(err) {
        console.log("Plugin failed", err)
        call.end()
      })
    } else {
      if (!readRequest.cliResponse) {
        call.end()
        if (currentCliPromise) {
          currentCliPromise.reject("Expected cliResponse")
        }
        throw "Expected cliResponse"
      }
      // inform cli about response
      if (!currentCliPromise) {
        call.end()
        throw "Expected currentCliPromise"
      }
      let resolve = currentCliPromise.resolve
      currentCliPromise = null
      resolve(readRequest.cliResponse.output)
    }
  })
  call.on('end', function() {
    console.log('got end')
  })
}

function startGrpcServer(endpoint) {
  let server = new grpc.Server()
  server.addProtoService(readerPluginService.service, {
    Read: read
  })
  server.addProtoService(pluginRegistrationService.service, {
    GetCapabilities: getCapabilities
  })
  server.bind(endpoint, grpc.ServerCredentials.createInsecure())
  server.start()
}

if (require.main === module) {
  console.log("Starting gRPC server at", endpoint)
  startGrpcServer(endpoint)
}
