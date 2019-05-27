const Listr = require('listr')
const execa = require('execa')
const notifier = require('node-notifier')
const {cli} = require('cli-ux')
const {red, cyan, bold} = require('chalk')
const ask = require('./utils/ask')
const {capitalize, spacer} = require('./utils/helpers')
const type = require('./utils/types')

async function create(projectName, flags) {
  const {
    dbName,
    dbUser,
    dbPass,
    dbHost,
    dbPrefix,
    locale,
    email,
    siteUrl,
    plugins,
    themes,
  } = await ask(projectName, flags)
  spacer()

  const tasks = new Listr([
    {
      title: 'Download WordPress core',
      task: async () => {
        try {
          await execa.shell(`wp core download --locale=${locale}`)
        } catch (error) {
          throw new Error(error.stderr)
        }
      },
    },
    {
      title: 'Generate wp-config.php',
      task: async () => {
        const check = ('skip' in flags ? '--skip-check' : '')
        try {
          await execa.shell(`wp config create --dbname=${dbName} --dbuser=${dbUser} --dbpass=${dbPass} --dbhost=${dbHost} --dbprefix=${dbPrefix} --locale=${locale} ${check}`)
        } catch (error) {
          throw new Error(error.stderr)
        }
        execa.shell('wp config set WP_DEBUG true --raw')
      },
    },
    {
      title: 'Create database',
      enabled: () => !flags.skip,
      task: async () => {
        const siteTitle = capitalize(projectName)
        return new Listr([
          {
            title: 'Initialize database',
            task: async () => {
              try {
                await execa.shell('wp db create')
              } catch (error) {
                throw new Error(error.stderr)
              }
            },
          },
          {
            title: 'Generate tables',
            task: async () => {
              try {
                await execa.shell(`wp core install --admin_user=${type.ADMIN_USER} --admin_password=${type.ADMIN_PASSWORD} --admin_email=${email} --url=${siteUrl} --title=${siteTitle} --skip-email`)
              } catch (error) {
                throw new Error(error.stderr)
              }
            },
          },
          {
            title: 'Disable search engine indexing',
            enabled: () => flags.noIndex,
            task: async () => {
              try {
                await execa.shell('wp option set blog_public 0')
              } catch (error) {
                throw new Error(error.stderr)
              }
            },
          },
        ])
      },
    },
    {
      title: 'Download themes',
      skip: async () => {
        if (!themes.length) {
          return 'No theme selected'
        }
      },
      task: async () => {
        try {
          await execa.shell(`wp theme install ${themes.join(' ')}`)
        } catch (error) {
          throw new Error(error.stderr)
        }
      },
    },
    {
      title: 'Download plugins',
      skip: async () => {
        if (!plugins.length) {
          return 'No plugin selected'
        }
      },
      task: async () => {
        try {
          await execa.shell(`wp plugin install ${plugins.join(' ')}`)
        } catch (error) {
          throw new Error(error.stderr)
        }
      },
    },
  ])

  try {
    await tasks.run().then(() => {
      const adminUrl = [siteUrl, type.ADMIN_PATH].join('/')
      spacer()
      cli.url(cyan(adminUrl), adminUrl)
      console.log(`\nUsername: ${bold(type.ADMIN_USER)}`)
      console.log(`Password: ${bold(type.ADMIN_PASSWORD)}\n`)
      notifier.notify({
        title: 'create-wordpress',
        message: `Successfully created project ${projectName}.`,
      })
      process.exit()
    })
  } catch (error) {
    console.error(red('\nSomething went wrong'))
    console.log(error)
    process.exit(1)
  }
}

module.exports = (...args) => {
  return create(...args).catch(error => {
    console.error(error)
    process.exit(1)
  })
}
