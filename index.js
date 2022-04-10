const { fetch } = require('cross-fetch');
const axios = require('axios');
const { print } = require('graphql');
const waitOn = require('wait-on');
const { ApolloServerPluginLandingPageDisabled } = require('apollo-server-core');
const { ApolloServer } = require('apollo-server');
const { introspectSchema } = require('@graphql-tools/wrap');
const { stitchSchemas } = require('@graphql-tools/stitch');
const xsenv = require('@sap/xsenv');

if (process.env.NODE_ENV === 'standalone'){
    xsenv.loadEnv('docker-env.json');
}


// Builds a remote schema executor function,
// customize any way that you need (auth, headers, etc).
// Expects to receive an object with "document" and "variable" params,
// and asynchronously returns a JSON response from the remote.
function makeRemoteExecutor(url) {
  return async ({ document, variables, context }) => {
    const query = typeof document === 'string' ? document : print(document);
    try {
      const response = await axios({
        method: 'post',
        url: url,
        data: JSON.stringify({ query, variables }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    }
    catch (error) {
      console.error(error);
      throw error;
    }
  };

};

const getVisualizationsIdsFromContent = (contents) => {
  let vizsIds = new Map();
  contents.WorkPage.Rows.forEach(row => {
    row.Columns.forEach(column => {
      column.Cells.forEach(cell => {
        cell.Widgets.forEach(widget => {
          vizsIds.set(widget.Visualization.ID, widget.Visualization.ID);
        });
      });
    });
  });
  return Array.from(vizsIds.keys());
};

async function makeGatewaySchema() {
  try {
    const coreExecutor = makeRemoteExecutor(process.env.CORE_SERVICE_URL);
    const runtimeExecutor = makeRemoteExecutor(process.env.RUNTIME_SERVICE_URL);
    const coreSchema = await introspectSchema(coreExecutor, {});
    const runtimeSchema = await introspectSchema(runtimeExecutor, {});
    return stitchSchemas({
      subschemas: [
        {
          schema: coreSchema,
          executor: coreExecutor,
          merge: {
            WorkPage: {
              fieldName: 'WorkPage',
              args: originalObject => ({ Id: originalObject.Id, vizsIds: getVisualizationsIdsFromContent(originalObject.Contents) })
            }
          }
        },
        {
          schema: runtimeSchema,
          executor: runtimeExecutor,
          merge: {
            WorkPage: {
              fieldName: 'WorkPage',
              args: originalObject => ({ ...originalObject })
            },
          }
        }
      ]
    });
  } catch (error) {
    console.log(error)  
  }
}

// waitOn({ resources: ['https://portal-cf-graphql-cdm-runtime.cfapps.sap.hana.ondemand.com:8080', 'https://portal-cf-graphql-cdm-core.cfapps.sap.hana.ondemand.com:8080'] }, async () => {
//   const mergedSchemas = await makeGatewaySchema();
//   const server = new ApolloServer({ schema: mergedSchemas });
//   return await server.listen(process.env.PORT, (url) => console.log(`gateway running at ${url}`));
// });

(async function () {
  let mergedSchemas,plugins;
  try {
    mergedSchemas = await makeGatewaySchema();
    console.log("mergedSchemas", mergedSchemas);
  }
  catch (err) {
    console.log("Error " + JSON.stringify(err))
  }
  if (process.env.NODE_ENV !== 'standalone'){
    plugins = [ApolloServerPluginLandingPageDisabled()]
  }
  const server = new ApolloServer({
    schema: mergedSchemas,
    plugins: plugins
  });
  return await server.listen(process.env.PORT, (url) => console.log(`gateway running at localhost:4003/graphql`));
}());