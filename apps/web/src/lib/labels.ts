export const SERVICE_ZONE_LABELS: Record<string, string> = {
  lehigh_core: 'Lehigh Acres (core)',
  service_area: 'Zona de servicio (200 km)',
  out_of_area: 'Fuera de zona',
  unknown: 'Sin ubicación',
};

export function serviceZoneLabel(zone: string): string {
  return SERVICE_ZONE_LABELS[zone] ?? zone;
}
