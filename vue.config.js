module.exports = {
    pluginOptions: {
        electronBuilder: {
            name: "Process Manager",
            preload: {
                preload: 'src/preload.js',
                loader: 'src/loader.js',
            },
            builderOptions: {
                productName: "Process Manager",
                appId: "Process Manager",
                win: {
                    icon: './icon.png'
                },
                "extraFiles": [
                    {
                        "from": "src/assets",
                        "to": "resources",
                        "filter": [
                            "**/*"
                        ]
                    }
                ],
            }
        }
    }
}