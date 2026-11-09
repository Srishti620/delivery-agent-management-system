export const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on_leave', label: 'On leave' },
];

export const VEHICLE_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'motorbike', label: 'Motorbike' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
];

export const labelFor = (options, value) => options.find((o) => o.value === value)?.label ?? value;

export const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
