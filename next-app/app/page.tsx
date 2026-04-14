import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/home");
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <header className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-white/15 backdrop-blur-sm grid place-items-center">
              <span className="font-black text-lg">UL</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Uniform Logistic
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-orange-600 shadow-sm hover:bg-orange-50 transition"
            >
              Iniciar sesión
            </Link>
          </div>
        </nav>

        <div className="mx-auto max-w-6xl px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
          <h1 className="max-w-3xl text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
            Uniformes empresariales, <br className="hidden sm:block" />
            pedidos sin complicaciones.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-orange-50/90">
            Catálogo personalizado por empresa, tallas exactas, seguimiento
            de pedidos y facturación electrónica — todo en un solo lugar.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-semibold text-orange-600 shadow-lg hover:bg-orange-50 transition"
            >
              Entrar al portal
            </Link>
            <a
              href="mailto:ventas@uniformlogistic.cr"
              className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 backdrop-blur-sm px-8 py-3.5 text-base font-semibold text-white hover:bg-white/20 transition"
            >
              Contactar ventas
            </a>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              title: "Catálogo por empresa",
              desc: "Cada cliente ve solo los productos y tallas autorizadas para su equipo.",
            },
            {
              title: "Pedidos trazables",
              desc: "Seguimiento de estado, historial completo y PDFs de insumos listos para producción.",
            },
            {
              title: "Factura electrónica CR",
              desc: "Emite facturas electrónicas v4.4 ante Hacienda directamente desde cada pedido.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="h-10 w-10 rounded-lg bg-orange-100 text-orange-600 grid place-items-center font-black">
                ✓
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-900">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-zinc-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Uniform Logistic</span>
          <span>Costa Rica</span>
        </div>
      </footer>
    </div>
  );
}
