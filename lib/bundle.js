require('source-map-support').install({ environment: 'node', hookRequire: true, handleUncaughtExceptions: true })
const path = require('path')
const webpack = require('webpack')

const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = (name, entry, dest) => {
	entry = path.resolve(dest, entry || './index.js')
	return new Promise((resolve, reject) => {
		const opts = {
		  entry,
		  target: 'node',
          externals: [
            function(context, request, callback) {
                if (/^\.(.*)/.test(request) || /^\/(.*)/.test(request)) {
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
					compilerOptions: {
						types: [
							"node"
						]
					},
					transpileOnly: true
				}
			  },
			  {
				test: /\.tsx?$/,
				loader: 'ts-loader',
			    options: { 
					compilerOptions: {
						types: [
							"node"
						]
					},
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
