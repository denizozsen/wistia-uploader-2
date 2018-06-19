'use strict';

module.exports = {
    entry: './src/js/app.js',
    output: {
        path: __dirname + '/website/js',
        publicPath: 'js/',
        filename: '[name].js',
        sourceMapFilename: 'maps/[file].map'
    },
    plugins: [

    ]
};
