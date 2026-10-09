
/* ---------- Helpers y utilidades ---------- */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
      // ===========================
      // 📊 contadores (Durable Objects)
      // ===========================
      //if (path.startsWith('/contadores/') && method === 'POST') {
      //  if (request.method === 'OPTIONS') {
      //    return new Response(null, {
      //      status: 204,
      //      headers: {
      //        'Access-Control-Allow-Origin': '*',
      //        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      //        'Access-Control-Allow-Headers': 'Content-Type'
      //      }
      //    });
      //  }
      //  const doId = env.CONTADOR_DO.idFromName("jabrascan-visitas-global");
      //  const stub = env.CONTADOR_DO.get(doId);
      //  return stub.fetch(request);
      //}
      if (path === "/contadores/test") {
        return json({ ok: true });
      }
      if (path === "/contadores/incrementar") {
        //return json({ ok: true });
        const doId = env.CONTADOR_DO.idFromName("jabrascan-visitas-global");
        const stub = env.CONTADOR_DO.get(doId);
        return stub.fetch(request);
      }
      if (path === "/contadores/leer") {
        const doId = env.CONTADOR_DO.idFromName("jabrascan-visitas-global");
        const stub = env.CONTADOR_DO.get(doId);
        return stub.fetch(request);
      }
  }
};
// ==========================================
// 🏛️ CLASE DEL DURABLE OBJECT PARA VISITAS
// ==========================================
export class GestorVisitasDO {
  constructor(state, env) {
    this.state = state;
  }

  getFechaActualizacion() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405 });
    }

    let id = null;
    try {
      const body = await request.json();
      id = body.id_obra || body.id;
    } catch (e) {}

    if (!id) {
      return new Response("Error: ID no proporcionado", { status: 400 });
    }

    const isObra = id.startsWith("obra_");

    // 📖 LEER CONTADOR
    if (path.includes('/leer')) {
      const record = await this.state.storage.get(id);
      if (!record) return new Response("0", { headers: { 'Content-Type': 'text/plain' } });

      let totalVisitas = record.visitas || 0;
      if (isObra) {
        totalVisitas += record.visitasCapitulos || 0;
      }
      return new Response(String(totalVisitas), { headers: { 'Content-Type': 'text/plain' } });
    }

    // 📈 INCREMENTAR CONTADOR
    if (path.includes('/incrementar')) {
      const fecha = this.getFechaActualizacion();
      const obra = isObra ? id.replace("obra_", "") : (id.split("_")[0] || "");

      let record = await this.state.storage.get(id);
      let mensaje = "";

      if (record) {
        record.visitas = (record.visitas || 0) + 1;
        record.fechaActualizacion = fecha;
        await this.state.storage.put(id, record);
        mensaje = "✅ OK inc 1";
      } else {
        record = {
          id: id,
          visitas: 1,
          valoracion: 5,
          fechaActualizacion: fecha,
          votos: 0,
          obra: obra,
          visitasCapitulos: 0
        };
        await this.state.storage.put(id, record);
        mensaje = "🆕 OK inc nuevo";
      }

      // Si es un capítulo, sumamos al acumulado de la obra padre
      if (!isObra && id.includes('_')) {
        const obraKey = `obra_${obra}`;
        let obraRecord = await this.state.storage.get(obraKey) || {
          id: obraKey,
          visitas: 0,
          valoracion: 5,
          fechaActualizacion: fecha,
          votos: 0,
          obra: obra,
          visitasCapitulos: 0
        };
        obraRecord.visitasCapitulos = (obraRecord.visitasCapitulos || 0) + 1;
        obraRecord.fechaActualizacion = fecha;
        await this.state.storage.put(obraKey, obraRecord);
      }

      return new Response(mensaje, { headers: { 'Content-Type': 'text/plain' } });
    }

    return new Response("Not found", { status: 404 });
  }
}