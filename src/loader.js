/**
 * Se importan modulos para instanciar procesos
 */
const {spawn} = require('child_process');
const fs = require('fs');

/**
 * Clase que maneja el listado de procesos
 */
class ProcessLoader {

    /**
     * Constructor
     */
    constructor(basePath) {

        /**
         * Directorio de logs de salida
         * 
         * @type {String}
         */
        this.outDir = "";

        /**
         * Listado de procesos
         * 
         * @type {Object}
         */
        this.processes = {};

        /**
         * callback de status del proceso principal
         */
        this.callbackStatus = () => {};

        /**
         * Ruta base
         */
        this.basePath = basePath;
    }

    /**
     * Funcion encargada de leer el archivo de scripts
     * y llenar el listado de procesos
     * 
     * @return {void}
     */
    read() {

        this.mainLog("Se carga archivo de configuracion en "+this.basePath+'/config.json');
        const data = fs.readFileSync(this.basePath+'/config.json',{
            encoding:'utf8', flag:'r'
        });
        const config = JSON.parse(data);

        // Parametros de los intentos
        let tries = config.tries || -1;
        let triesSleep = config.triesSleep || 1000;

        // Se guarda la direccion de la carpeta de salida
        this.outDir = config.outDir;

        // Se recorre el diccionario de procesos a ejecutar
        this.mainLog("Se inicia carga de definiciones de proceso");
        if (config.hasOwnProperty("processes")) {
            for (var label in config.processes) {

                // Se recupera la definicion del proceso
                let def = config.processes[label];

                // Script del proceso
                let script, pTries, pTriesSleep;

                // Si la definicion corresponde a un objeto
                if (typeof def == "object") {
                    script = def.script;
                    pTries = def.tries || tries;
                    pTriesSleep = def.triesSleep || triesSleep;
                } else {
                    script = def;
                    pTries = tries;
                    pTriesSleep = triesSleep;
                }

                /**
                 * Se guarda la definicion del proceso
                 */
                this.processes[label] = {

                    /**
                     * Script asociado
                     */
                    script: script,

                    /**
                     * Cantidad de intentos
                     */
                    tries: 0,

                    /**
                     * Máxima cantidad de intentos
                     */
                    maxTries: pTries,

                    /**
                     * Tiempo en que duerme el proceso
                     * antes del reinicio
                     */
                    triesSleep: pTriesSleep,

                    /**
                     * Status del proceso
                     * (0) Apagado
                     * (1) Iniciando
                     * (2) Iniciado
                     * (3) Deteniendose
                     * (4) Error
                     */
                    status: 0,

                    /**
                     * Proceso asociado
                     */
                    proc: null,

                    /**
                     * Log de salida del proceso
                     */
                    logPath: this.outDir+label+".log"
                };
            }
        }

        // Se crean logs
        this.mainLog("Se inician logs");
        this.makeLogs();
    }

    /**
     * Crea los archivos de logs en lo posible
     * 
     * @return {void}
     */
    makeLogs() {
        for (var label in this.processes) {
            var process = this.processes[label];
            if (!fs.existsSync(process.logPath)) {
                fs.writeFileSync(process.logPath,'');
            }
        }
    }

    /**
     * Escribe logs de la aplicacion principal
     * @param {String} data 
     */
    mainLog(data) {
        let basePath = this.basePath+"/main.log";
        let date = new Date().toLocaleString("es-ES", {timeZone: "America/Santiago"}).replace(/T/, ' ').replace(/\..+/, '');
        let lines = data.split("\n");
        for (let i in lines) {
            let line = lines[i];
            let result = "["+date+"] "+line+"\n";
            fs.appendFile(basePath,result,function(err) {
                if (err) throw err;
            });
        }
    }

    /**
     * Prepara los datos a enviar para el spawn
     * 
     * @param {String} label
     * @return {Array}
     */
    prepareSpawn(label) {
        let result = [];
        if (this.processes.hasOwnProperty(label)) {
            result = this.processes[label].script.split(" ");
        }
        return result;
    }

    /**
     * Permite que un while no detenga el proceso principal
     * 
     * @param {Number} ms milisegundos de espera
     * @return {Promise}
     */
    sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }

    /**
     * Comienza todos los scripts
     */
    async startAll() {
        for (var label in this.processes) {
            await this.sleep(50);
            this.start(label);
        }
    }

    /**
     * Inicia un proceso
     */
    start(label) {
        if (typeof this.callbackStatus !== "undefined") {
            if (this.processes.hasOwnProperty(label)) {
                this.mainLog("Se inicia proceso asociado a "+label);
    
                // Se prepara los datos de spawn
                let spawnArray = this.prepareSpawn(label);
                let firstElem = spawnArray.shift();
                
                // Se comunica status del proceso
                this.status(label,1);

                // Se instancia el proceso
                this.processes[label].proc = spawn(firstElem,spawnArray,{ 
                    stdio: ["pipe","pipe","pipe"]
                });
    
                // Si el proceso fue iniciado con exito
                this.processes[label].proc.on("spawn",() => {
                    this.status(label,2);
                });
                
                // Si el proceso recibe informacion por stdout
                this.processes[label].proc.stdout.on('data',(data) => {
                    this.writeLog(label, data.toString().trim());
                    this.status(label,2);
                });

                // Si el proceso recibe informacion por stderr
                this.processes[label].proc.stderr.on('data',(data) => {
                    this.writeLog(label, "[ERROR] "+data.toString().trim());
                });

                // Si el proceso erro al iniciar
                this.processes[label].proc.on("error",() => {
                    this.status(label,4);
                });

                // Si el proceso termino
                this.processes[label].proc.on("exit",() => {
                    this.status(label,3);
                });

                // Si el proceso fue cerrado con exito
                this.processes[label].proc.on("close",() => {
                    this.status(label,0);
                });
            }
        }
    }

    /**
     * Metodo que sirve para comunicar los cambios de estado de los procesos
     * @param {Function} callback 
     */
    onStatusChange(callback) {
        this.callbackStatus = callback;
    }

    /**
     * Manda la señal pára actualizar el status
     * @param {String} label 
     * @param {Number} status 
     */
    status(label, status) {
        if (typeof this.callbackStatus !== "undefined") {
            this.callbackStatus(label,status);
        }
    }

    /**
     * Escribe sobre el log de un archivo
     */
    writeLog(label, data) {
        if (this.processes.hasOwnProperty(label)) {
            let filePath = this.processes[label].logPath;
            let date = new Date().toLocaleString("es-ES", {timeZone: "America/Santiago"}).replace(/T/, ' ').replace(/\..+/, '');
            let lines = data.split("\n");
            for (let i in lines) {
                let line = lines[i];
                let result = "["+date+"] "+line+"\n";
                fs.appendFile(filePath,result,function(err) {
                    if (err) throw err;
                });
            }
        }
    }

    /**
     * Detiene un proceso en especifico
     * @param {String} label 
     */
    kill(label) {
        if (this.processes.hasOwnProperty(label)) {
            if (this.processes[label].proc !== null) {
                this.mainLog("Se termina proceso asociado a "+label);
                this.processes[label].proc.kill();
            }
        }
    }

    /**
     * Detiene todos los procesos
     */
    killAll() {
        for (var label in this.processes) {
            this.kill(label);
        }
    }
}

/**
 * Se exporta clase
 */
module.exports.ProcessLoader = ProcessLoader;