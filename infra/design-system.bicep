// Trellis Design System — Azure Static Web App
//
// Provisions the Free-tier Static Web App that hosts the design system
// documentation (docs/mocks/design-system). Content is deployed by the
// GitHub Actions workflow .github/workflows/deploy-design-system.yml
// (bring-your-own-CI), not by a linked repository.
//
// Deploy:
//   az group create --name rg-trellis-design-system --location eastus2
//   az deployment group create \
//     --resource-group rg-trellis-design-system \
//     --template-file infra/design-system.bicep
//
// Afterwards, copy the deployment token into the repository secret
// AZURE_STATIC_WEB_APPS_API_TOKEN:
//   az staticwebapp secrets list --name trellis-design-system \
//     --query properties.apiKey -o tsv

@description('Name of the Static Web App.')
param name string = 'trellis-design-system'

@description('Region for the Static Web App control plane.')
@allowed(['westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia'])
param location string = 'eastus2'

resource designSystem 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // No linked repo: content is pushed by GitHub Actions with the
    // deployment token (bring-your-own-CI).
    allowConfigFileUpdates: true // honor staticwebapp.config.json
    stagingEnvironmentPolicy: 'Enabled'
  }
}

output defaultHostname string = designSystem.properties.defaultHostname
output staticWebAppName string = designSystem.name
