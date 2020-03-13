require('source-map-support').install({ environment: 'node', hookRequire: true, handleUncaughtExceptions: true })
const path = require('path')
const webpack = require('webpack')

module.exports = (name, entry, dest, addon) => {
	entry = path.resolve(dest, entry || './index.js')
	const compilerOptions = addon.compilerOptions || {}
	if (!(compilerOptions.typeRoots || []).includes('node_modules/@types/'))
		compilerOptions.typeRoots = (compilerOptions.typeRoots || []).concat(['node_modules/@types/'])
	if (!compilerOptions.sourceMap)
		compilerOptions.sourceMap = true
	return new Promise((resolve, reject) => {
		const opts = {
		  entry,
		  target: 'node',
		  devtool: 'inline-source-map',
		  externals: [
			function(context, request, callback) {
				if (/^\.(.*)/.test(request) || path.isAbsolute(request)) {
					return callback()
				}
				callback(null, "commonjs " + request)
			}
		  ],
		  output: {
			library: name,
			libraryTarget: 'umd',
			filename: 'prebuilt.js',
			path: dest
		  },
		  module: {
			rules: [
			  {
				test: /\.ts?$/,
				loader: 'ts-loader',
				options: { 
					compilerOptions,
					transpileOnly: true
				}
			  },
			  {
				test: /\.tsx?$/,
				loader: 'ts-loader',
				options: { 
					compilerOptions,
					transpileOnly: true
				}
			  },
			],
		  },
			resolve: {
				symlinks: false,
				extensions: ['.tsx', '.ts', '.js', '.json'],
			}
		}

		webpack(opts).run((err, stats) => {
		  if (err || stats.hasErrors()) {
		  	if (err)
			  	console.log(err)
			else {
				if ((((stats || {}).compilation || {}).errors || []).length)
					stats.compilation.errors.forEach(err => {
						console.log(err)
					})
				else
					console.log('Unknown bundling error for module: ' + name)
			}
		  	reject({ errors: true })
		  	return
		  }
		  resolve({ success: true })
		})
	})
}
