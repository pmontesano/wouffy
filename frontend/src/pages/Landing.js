import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  Shield,
  Clock,
  Star,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#F0FDF4] to-white py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              className="lg:col-span-7"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1F2937] mb-6 leading-tight"
                style={{ fontFamily: "Outfit" }}
                data-testid="hero-title"
              >
                Encontrá el paseador ideal para tu mascota en minutos
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed">
                Conectamos dueños responsables con paseadores profesionales y
                confiables. Tu mejor amigo merece los mejores paseos.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/walkers"
                  className="btn-primary inline-flex items-center justify-center space-x-2"
                  data-testid="hero-cta-button"
                >
                  <span>Buscar Paseadores</span>
                  <ArrowRight size={20} />
                </Link>
                <Link
                  to="/login"
                  className="btn-secondary inline-flex items-center justify-center"
                  data-testid="hero-secondary-button"
                >
                  Quiero ser paseador
                </Link>
              </div>
            </motion.div>

            <motion.div
              className="lg:col-span-5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1759914915105-37d1b016a982?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwyfHxoYXBweSUyMGRvZyUyMHBvcnRyYWl0JTIwcGFya3xlbnwwfHx8fDE3NzExOTg3NjV8MA&ixlib=rb-4.1.0&q=85"
                  alt="Perro feliz en el parque"
                  className="w-full h-auto rounded-3xl shadow-2xl"
                />
                <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-4 shadow-xl">
                  <div className="flex items-center space-x-2">
                    <Star className="text-[#FFCC99]" fill="#FFCC99" size={24} />
                    <div>
                      <p className="font-bold text-lg">4.9/5</p>
                      <p className="text-sm text-gray-600">
                        Calificación promedio
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section
        className="py-20 bg-[#F9FAFB]"
        data-testid="how-it-works-section"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-3xl sm:text-4xl font-bold text-center text-[#1F2937] mb-4"
            style={{ fontFamily: "Outfit" }}
          >
            ¿Cómo funciona?
          </h2>
          <p className="text-center text-gray-600 mb-12 text-lg">
            Tres simples pasos para el mejor paseo
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              className="bg-white rounded-3xl p-8 shadow-lg card-hover text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              data-testid="step-1"
            >
              <div className="w-16 h-16 bg-[#88D8B0] bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPin size={32} className="text-[#88D8B0]" />
              </div>
              <h3
                className="text-xl font-bold mb-3"
                style={{ fontFamily: "Outfit" }}
              >
                1. Buscá cerca tuyo
              </h3>
              <p className="text-gray-600">
                Ingresá tu ubicación y descubrí paseadores profesionales en tu
                zona.
              </p>
            </motion.div>

            <motion.div
              className="bg-white rounded-3xl p-8 shadow-lg card-hover text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              data-testid="step-2"
            >
              <div className="w-16 h-16 bg-[#FFCC99] bg-opacity-30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock size={32} className="text-[#FFCC99]" />
              </div>
              <h3
                className="text-xl font-bold mb-3"
                style={{ fontFamily: "Outfit" }}
              >
                2. Elegí fecha y hora
              </h3>
              <p className="text-gray-600">
                Seleccioná el horario que mejor te convenga y completá los
                detalles del paseo.
              </p>
            </motion.div>

            <motion.div
              className="bg-white rounded-3xl p-8 shadow-lg card-hover text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              data-testid="step-3"
            >
              <div className="w-16 h-16 bg-[#88D8B0] bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} className="text-[#88D8B0]" />
              </div>
              <h3
                className="text-xl font-bold mb-3"
                style={{ fontFamily: "Outfit" }}
              >
                3. Confirmá y listo
              </h3>
              <p className="text-gray-600">
                El paseador acepta tu solicitud y tu mascota disfruta del mejor
                paseo.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white" data-testid="benefits-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-3xl sm:text-4xl font-bold text-center text-[#1F2937] mb-4"
            style={{ fontFamily: "Outfit" }}
          >
            ¿Por qué elegir Wouffy?
          </h2>
          <p className="text-center text-gray-600 mb-12 text-lg">
            Confianza y seguridad para tu mejor amigo
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div
              className="bg-gradient-to-br from-[#88D8B0] to-[#6FCF9F] rounded-3xl p-8 text-white"
              data-testid="benefit-1"
            >
              <Shield size={40} className="mb-4" />
              <h3
                className="text-xl font-bold mb-3"
                style={{ fontFamily: "Outfit" }}
              >
                Paseadores Verificados
              </h3>
              <p className="opacity-90">
                Todos nuestros paseadores están verificados y cuentan con
                experiencia comprobada.
              </p>
            </div>

            <div
              className="bg-gradient-to-br from-[#FFCC99] to-[#FFBF80] rounded-3xl p-8 text-white"
              data-testid="benefit-2"
            >
              <Star size={40} className="mb-4" />
              <h3
                className="text-xl font-bold mb-3"
                style={{ fontFamily: "Outfit" }}
              >
                Calificaciones Reales
              </h3>
              <p className="opacity-90">
                Lee opiniones de otros dueños y elige con confianza el mejor
                paseador.
              </p>
            </div>

            <div
              className="bg-gradient-to-br from-[#88D8B0] to-[#6FCF9F] rounded-3xl p-8 text-white"
              data-testid="benefit-3"
            >
              <Clock size={40} className="mb-4" />
              <h3
                className="text-xl font-bold mb-3"
                style={{ fontFamily: "Outfit" }}
              >
                Flexibilidad Total
              </h3>
              <p className="opacity-90">
                Reservá paseos cuando lo necesites, con la duración que
                prefieras.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="py-20 bg-[#F9FAFB]"
        data-testid="testimonials-section"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-3xl sm:text-4xl font-bold text-center text-[#1F2937] mb-12"
            style={{ fontFamily: "Outfit" }}
          >
            Lo que dicen nuestros usuarios
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div
              className="bg-white rounded-3xl p-8 shadow-lg"
              data-testid="testimonial-1"
            >
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={20}
                    className="text-[#FFCC99]"
                    fill="#FFCC99"
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-6">
                "Excelente servicio. María es una paseadora increíble y mi perro
                la adora. Totalmente recomendado."
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-[#88D8B0] rounded-full flex items-center justify-center text-white font-bold">
                  JP
                </div>
                <div>
                  <p className="font-semibold">Juan Pérez</p>
                  <p className="text-sm text-gray-500">Dueño en Palermo</p>
                </div>
              </div>
            </div>

            <div
              className="bg-white rounded-3xl p-8 shadow-lg"
              data-testid="testimonial-2"
            >
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={20}
                    className="text-[#FFCC99]"
                    fill="#FFCC99"
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-6">
                "La plataforma es muy fácil de usar y los paseadores son super
                responsables. Mi perra vuelve feliz de cada paseo."
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-[#FFCC99] rounded-full flex items-center justify-center text-white font-bold">
                  LM
                </div>
                <div>
                  <p className="font-semibold">Laura Martínez</p>
                  <p className="text-sm text-gray-500">Dueña en Recoleta</p>
                </div>
              </div>
            </div>

            <div
              className="bg-white rounded-3xl p-8 shadow-lg"
              data-testid="testimonial-3"
            >
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={20}
                    className="text-[#FFCC99]"
                    fill="#FFCC99"
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-6">
                "Como paseador, Wouffy me permitió conseguir clientes de forma
                rápida y segura. Excelente plataforma."
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-[#88D8B0] rounded-full flex items-center justify-center text-white font-bold">
                  CF
                </div>
                <div>
                  <p className="font-semibold">Carlos Fernández</p>
                  <p className="text-sm text-gray-500">Paseador en Caballito</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#1F2937] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3
                className="text-2xl font-bold mb-4"
                style={{ fontFamily: "Outfit" }}
              >
                Wouffy
              </h3>
              <p className="text-gray-400">
                La forma más fácil y segura de encontrar paseadores para tu
                mascota.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Enlaces</h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/walkers"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Buscar Paseadores
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Iniciar Sesión
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contacto</h4>
              <p className="text-gray-400">info@wouffy.com</p>
              <p className="text-gray-400">Buenos Aires, Argentina</p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>
              © {new Date().getFullYear()} Wouffy. Todos los derechos
              reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
