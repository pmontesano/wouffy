"""
Servicio de geocodificación usando OpenStreetMap Nominatim (gratuito).
Limitaciones: 1 request/segundo, no para uso comercial masivo.
Para producción a escala: migrar a Mapbox Geocoding API (free tier: 100k req/mes).
"""
from __future__ import annotations

import logging
from typing import Optional, Tuple

import httpx

log = logging.getLogger(__name__)

# Nominatim requiere un User-Agent descriptivo
_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_USER_AGENT = "Wouffy/1.0 (dog walking app; contact@wouffy.app)"
_TIMEOUT = 8.0


async def geocode_address(
    address_text: Optional[str],
    city: Optional[str],
    country: str = "Argentina",
) -> Optional[Tuple[float, float]]:
    """
    Convierte una dirección textual a coordenadas (lat, lng).

    Retorna (latitude, longitude) si tiene éxito, o None si falla/no hay datos.
    Nunca lanza excepción — fallo silencioso para no bloquear el guardado del perfil.

    Ejemplo:
        lat, lng = await geocode_address("Av. Santa Fe 1234", "Buenos Aires")
        # → (-34.5965, -58.3974)
    """
    parts = [p for p in [address_text, city, country] if p and p.strip()]
    if not parts:
        return None

    query = ", ".join(parts)

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                _NOMINATIM_URL,
                params={
                    "q": query,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 0,
                },
                headers={"User-Agent": _USER_AGENT},
                timeout=_TIMEOUT,
            )
            resp.raise_for_status()
            results = resp.json()

        if not results:
            # Sin resultados: probar solo con ciudad
            if city and address_text:
                return await geocode_address(None, city, country)
            return None

        lat = float(results[0]["lat"])
        lng = float(results[0]["lon"])
        log.info("Geocodificado '%s' → (%.6f, %.6f)", query, lat, lng)
        return (round(lat, 6), round(lng, 6))

    except httpx.TimeoutException:
        log.warning("Timeout al geocodificar '%s'", query)
        return None
    except (httpx.HTTPError, KeyError, ValueError, IndexError) as e:
        log.warning("Error al geocodificar '%s': %s", query, e)
        return None


async def reverse_geocode(lat: float, lng: float) -> Optional[str]:
    """
    Convierte coordenadas a una dirección textual (reverse geocoding).
    Útil para mostrar la dirección cuando solo se tienen coordenadas GPS.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": lat,
                    "lon": lng,
                    "format": "json",
                },
                headers={"User-Agent": _USER_AGENT},
                timeout=_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("display_name")

    except (httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("Error en reverse geocoding (%.6f, %.6f): %s", lat, lng, e)
        return None
