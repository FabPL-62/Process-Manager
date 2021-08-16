<template>
  <div>
    <table class="table table-bordered w-100">
      <thead>
        <tr>
          <th style="width: 150px;">Nombre</th>
          <th>Script</th>
          <th style="width: 100px;">Estado</th>
          <th style="width: 180px;">Opciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(process, label) in processes" v-bind:key="label">
          <td>{{ label }}</td>
          <td style="text-align: left; font-family: Consolas;">{{ process.script }}</td>

          <td v-if="process.status == 0"><button class="btn btn-secondary no-cursor">Apagado</button></td>
          <td v-else-if="process.status == 1"><button class="btn btn-primary no-cursor">Iniciando</button></td>
          <td v-else-if="process.status == 2"><button class="btn btn-success no-cursor">Iniciado</button></td>
          <td v-else-if="process.status == 3"><button class="btn btn-primary no-cursor">Deteniendose</button></td>
          <td v-else-if="process.status == 4"><button class="btn btn-danger no-cursor">Error</button></td>

          <td>
            <button v-if="process.status == 0 || process.status == 4" class="btn btn-success btn-next" @click="startProcess(label)">Iniciar</button>
            <button v-else-if="process.status == 1" class="btn btn-danger" disabled>Detener</button>
            <button v-else-if="process.status == 2" class="btn btn-danger btn-next" @click="endProcess(label)">Detener</button>
            <button v-else-if="process.status == 3" class="btn btn-success" disabled>Iniciar</button>

            <button class="btn btn-info ml-2" @click="showLogs(process.logPath)">Logs</button>
          </td>

        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      processes: {},
      logPath: ""
    }
  },
  mounted() {
    window.ipc.on('init', (data) => {
      this.processes = data.processes;
      this.logPath = data.logPath;
    });
    window.ipc.on('status', (data) => {
      this.processes[data.label].status = data.status;
    });
  },
  methods: {
    showLogs(path) {
      window.ipc.send('logPath',path);
    },
    startProcess(label) {
      window.ipc.send('start',label);
    },
    endProcess(label) {
      window.ipc.send('end',label);
    }
  }
}
</script>

<style>
body, html {
  background-color: #242424;
}
.table {
  background-color: #242424 !important;
  border: 1px solid #2e2e2e !important;
}
.table td {
  color: rgb(163, 163, 163);
  border: 1px solid #2e2e2e !important;
}
.table th {
  color: rgb(192, 192, 192);
  border: 1px solid #2e2e2e !important;
}
.badge {
  font-size: 12px !important;
}
.btn {
  font-size: 12px !important;
}
.btn:not(.no-cursor) {
  cursor: pointer;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 12px;
  text-align: center;
  color: #2c3e50;
}
</style>
