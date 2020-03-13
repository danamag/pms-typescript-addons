const fs = require('fs')
const needle = require('needle')
const rimraf = require('rimraf')
const async = require('async')
const path = require('path')
const addonsDir = path.join(__dirname, '..')
const unzip = require('./unzip')
const bundle = require('./bundle')

const addons = require('../addonsList')

function parseRepo(github) {
	const parts = github.split('/')
	const user = parts[0]
	let repo
	let tree
	if (parts[1].includes('#')) {
		repo = parts[1].split('#')[0]
		tree = parts[1].split('#')[1]
	} else {
		repo = parts[1]
		tree = 'master'
	}
	return { user, repo, tree }
}

function getVersion(github, cb) {
	return new Promise((resolve, reject) => {
		const repoData = parseRepo(github)
		if (repoData.repo) {
			const versionFile = path.join(addonsDir, repoData.repo, 'version.txt')
			fs.stat(versionFile, (err, stat) => {
				if (err == null)
					// version file exists
					fs.readFile(versionFile, (err, version) => {
						if (!err && version)
							resolve(version)
						else
							reject()
					})
				else
					reject()
			})
		} else
			reject()
	})
}

function zipBall(github) {
	return new Promise((resolve, reject) => {
		needle.get('https://api.github.com/repos/' + github + '/releases', (err, resp, body) => {
			if (body && Array.isArray(body) && body.length) {
				const tag = body[0].tag_name
				const zipBall = body[0].zipball_url
				resolve({
					tag: body[0].tag_name,
					zipBall: body[0].zipball_url
				})
			} else {
				if (err)
					console.error(err)
				reject(new Error('Could not get releases for: ' + github))
			}
		})
	})
}

const addonApi = {
	install: data => {
		return new Promise((resolve, reject) => {
			zipBall(data.repo).then(githubData => {
				const repoData = parseRepo(data.repo)
				const dest = path.join(addonsDir, repoData.repo)

				function installAddon() {
					needle('get', githubData.zipBall, { follow_max: 5 })
					.then(async zipFile => {
						const zipped = zipFile.body.toString('base64')
						unzip.extract(zipped, dest)
						data.tag = githubData.tag
						const bundled = await bundle(repoData.repo, data.entry, dest)
						if ((bundled || {}).success) {
							// write version to file
							const versionFile = path.join(addonsDir, repoData.repo, 'version.txt')
							fs.writeFile(versionFile, githubData.tag, err => {
								if (!err) {
									console.log('Add-on updated: ' + data.repo)
									resolve({ success: true })
								} else
									reject(err)
							})
						} else {
							console.log('Could not bundle add-on: ' + data.repo)
							console.log('Add-on failed updating: ' + data.repo)
							reject('Could not bundle add-on: ' + data.repo)
							return
						}

					})
					.catch(err => {
						console.log(repoData.repo + ' unzip error')
						console.error(err)
						reject(new Error((err || {}).message || 'Unknown Error Occurred'))
					})
				}

				function cleanDir(dest, cb) {
					fs.stat(dest, err => {
						if (!err)
							rimraf(dest, () => {
								fs.mkdir(dest, cb)
							})
						else if (err.code === 'ENOENT')
							fs.mkdir(dest, cb)
					})
				} 

				cleanDir(dest, installAddon)
			}).catch(err => {
				reject(err)
			})
		})
	},
	update: data => {
		if (!data.tag)
			return addonApi.install(data).catch(err => {
				return Promise.reject(err)
			})
		else
			return zipBall(data.repo).then(githubData => {
				if (data.tag != githubData.tag)
					return addonApi.install(data)
				else {
					console.log('Add-on does not need to be updated: ' + data.repo)
					return Promise.resolve()
				}
			}).catch(err => {
				return Promise.reject(err)
			})
	},
	init: () => {

		if ((addons || []).length) {

			let started = 0

			const runQueue = async.queue(async (task, cb) => {
				try {
					task.tag = await getVersion(task.repo)
				} catch(e) { }
				addonApi.update(task).then(() => {
					started++
					console.log('Transpiling addons: ' + started + ' / ' + addons.length)
					cb && cb()
				}).catch(err => {
					console.error(err)
					cb && cb()
				})
			})

			addons.forEach(data => { runQueue.push(data) })
		} else
			console.log('There are no addons in ./addonsList.json')

	}
}

module.exports = addonApi
