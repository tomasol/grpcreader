Create a link to gRPC proto folder called 'proto' in current folder:
```
ln -s ${MAGMA_REPO}/devmand/gateway/src/devmand/channels/cli/plugin/proto/ proto
```
Install dependencies into node_modules:
```
npm install
```
then run the Ubiquity plugin:
```
node plugin-ubnt-ifc-config-reader.js
```

or linux plugin:
```
node plugin-linux-ifc-reader.js
```

Either of those will start a gRPC server on 0.0.0.0:50051 .


Devmand needs to be configured as well, see doc/config-sample folder for details.
Devmand server will use PluginRegistration.proto::getCapabilities to obtain
readers, writers and their paths for given device type during startup.
