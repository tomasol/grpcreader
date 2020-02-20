const pathRegex = /^\/openconfig-interfaces:interfaces\/interface\[name='(.*)'\]\/config$/
const mtuRegex = /^mtu (\d+)$/m
const descriptionRegex = /^description '?(.+?)'?$/m
const shutdownRegex = /^shutdown$/m
const typeRegex = /^interface\s+(.+)$/m
const ethernetIfcRegx = /^\d+\/\d+$/

function parseValue(regex, input, closure, callClosureOnlyOnMatch) {
  let match = regex.exec(input)
  if (callClosureOnlyOnMatch && match == null) {
    return // undefined will be removed from json
  }
  return closure(match)
}

function parseIfcType(ifcName) {
  if (ifcName.indexOf("lag") == 0) {
    return "iana-if-type:Ieee8023adLag"
  } else if (ifcName.indexOf("vlan") == 0) {
    return "iana-if-type:L3ipvlan"
  } else if (ethernetIfcRegx.exec(ifcName)) {
    return "iana-if-type:ethernetCsmacd"
  }
  return "iana-if-type:Other"
}

async function reader(path, cli) {
  let pathMatch = pathRegex.exec(path)
  if (pathMatch == null) {
    throw "Cannot parse path"
  }
  let ifcName = pathMatch[1]
  const cmd = "show running-config interface " + ifcName
  cliResponse = await cli.executeRead(cmd)
  let model = {"name":ifcName}
  model["mtu"] = parseValue(mtuRegex, cliResponse, function(match){return parseInt(match[1])}, true)
  model["description"] = parseValue(descriptionRegex, cliResponse, function(match){return match[1]}, true)
  model["enabled"] = parseValue(shutdownRegex, cliResponse, function(match) {return match == null})
  model["type"] = parseValue(typeRegex, cliResponse, function(match) {return parseIfcType(match[1])}, true)
  return model
}
// -----------------------------------------------------------------------------------------------------------------

// grpc specifics start here
var PROTO_PATH = __dirname + "/proto/"
var grpc = require("grpc")
var readerPluginService = grpc.load(PROTO_PATH + "ReaderPlugin.proto").devmand.channels.cli.plugin.ReaderPlugin
var pluginRegistrationService = grpc.load(PROTO_PATH + "PluginRegistration.proto").devmand.channels.cli.plugin.PluginRegistration
// utils start
var sending = function(obj){console.log("Sending", obj); return obj;}
// utils end

// PluginRegistration.proto::GetCapabilities rpc
function getCapabilities(call, callback) {
  var deviceType = {device:'ubnt', version: '*'}
  var readerCapability = {path: '/openconfig-interfaces:interfaces/interface/config'}
  var response = {deviceType: deviceType, readers: [readerCapability]}
  console.log("getCapabilities request", call.request, "response", response)
  callback(null, response)
}

// ReaderPlugin.proto::Read rpc
function read(call) {
  console.log("read started")
  var currentCliPromise = null

  let executeRead = async function(cmd) {
    console.log("executeRead", cmd)
    if (currentCliPromise) {
      throw "Expected empty currentCliPromise"
    }
    var p = new Promise((resolve, reject) => {
      currentCliPromise = {
        resolve:resolve,
        reject: reject
      }
    })
    call.write(sending({cliRequest:{cmd:cmd}}))
    return p
  }
  var cli =  {"executeRead": executeRead}
  var started = false

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
      var resolve = currentCliPromise.resolve
      currentCliPromise = null
      resolve(readRequest.cliResponse.output)
    }
  })
  call.on('end', function() {
    console.log('got end')
  })
}

if (require.main === module) {
  var server = new grpc.Server()
  server.addProtoService(readerPluginService.service, {
    Read: read
  })
  server.addProtoService(pluginRegistrationService.service, {
    GetCapabilities: getCapabilities
  })
  server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure())
  server.start()
}
