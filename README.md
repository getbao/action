# getbao Deploy Action

Deploy your [getbao](https://getbao.dev) auth service to Cloudflare Workers from your GitHub workflow.

## What it does

1. Downloads your versioned release assets (worker bundles, migrations, Terraform configs) from the getbao API and caches them for the duration of the workflow
2. Provisions Cloudflare infrastructure with OpenTofu (D1 database, KV namespace) and commits the state back to your repo via pull request
3. Applies database migrations
4. Deploys the auth worker and secret rotation worker to Cloudflare Workers
5. Bootstraps encryption keys and auth secrets on first deploy

## Prerequisites

- A `bao.config.json` at the root of your repository ([docs](https://getbao.dev/docs/config))
- A getbao license key — [get one at getbao.dev](https://getbao.dev)
- A Cloudflare account with Workers and D1 enabled

## Usage

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: getbao/deploy-action@v1
        with:
          license_key: ${{ secrets.GETBAO_LICENSE_KEY }}
          api_token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          account_id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input          | Required | Default                  | Description                                                                 |
| -------------- | -------- | ------------------------ | --------------------------------------------------------------------------- |
| `license_key`  | ✅       | —                        | getbao license key                                                          |
| `api_token`    | ✅       | —                        | Cloudflare API token with Workers edit permissions                          |
| `account_id`   | ✅       | —                        | Cloudflare account ID                                                       |
| `github_token` | ✅       | —                        | GitHub token used to open the OpenTofu state pull request                   |
| `environment`  |          | `dev`                    | Deployment environment (`dev` or `production`)                              |
| `app_secrets`  |          | `{}`                     | JSON string of secrets to set on the worker (e.g. `${{ toJson(secrets) }}`) |
| `force_rotate` |          | `false`                  | Regenerate `BETTER_AUTH_SECRETS` from scratch — signs all users out         |
| `api_url`      |          | `https://api.getbao.dev` | Override the getbao API base URL                                            |

## Outputs

| Output           | Description                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `pr_url`         | URL of the pull request opened for the OpenTofu state update (empty if infrastructure did not change) |
| `deployment_url` | URL of the deployed Cloudflare Worker                                                                 |

## Production deployments

Use a [GitHub environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) to gate production deploys behind a required approval:

```yaml
jobs:
  deploy-dev:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: getbao/deploy-action@v1
        with:
          environment: dev
          license_key: ${{ secrets.GETBAO_LICENSE_KEY }}
          api_token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          account_id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          github_token: ${{ secrets.GITHUB_TOKEN }}

  deploy-prod:
    needs: deploy-dev
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: getbao/deploy-action@v1
        with:
          environment: production
          license_key: ${{ secrets.GETBAO_LICENSE_KEY }}
          api_token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          account_id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Secrets reference

| Secret                  | Where to get it                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GETBAO_LICENSE_KEY`    | [getbao.dev dashboard](https://getbao.dev/dashboard)                                                       |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare dashboard → My Profile → API Tokens → Create Token (use the _Edit Cloudflare Workers_ template) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar on the Workers overview page                                          |

## Versioning

| Tag       | Behaviour                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------- |
| `@v1`     | Floating — always the latest `v1.x.x`. Recommended for most users.                             |
| `@v1.2.3` | Pinned — frozen to an exact release. Use this if you need to control when you pick up updates. |

Security patches are released as new patch versions (e.g. `v1.2.4`). The floating `v1` tag moves automatically so consumers on `@v1` receive them on their next run.

## License

Usage requires a valid getbao license. See [getbao.dev/pricing](https://getbao.dev/pricing).
