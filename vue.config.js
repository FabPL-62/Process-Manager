module.exports = {
    pluginOptions: {
        electronBuilder: {
            preload: {
                preload: 'src/preload.js',
                loader: 'src/loader.js',
            }
        }
    }
}