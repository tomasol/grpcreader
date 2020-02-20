Create a link to gRPC proto folder called 'proto' in current folder:
```
ln -s ${MAGMA_REPO}/devmand/gateway/src/devmand/channels/cli/plugin/proto/ proto
```
Install dependencies into node_modules:
```
npm install
```
then run the plugin:
```
node grpcReader.js
```
This will start gRPC server on 0.0.0.0:50051

Devmand server will use PluginRegistration.proto::getCapabilities to obtain
readers, writers and their paths for given device type during startup.

This plugin only provides one reader, interface config reader for Ubiquity devices.