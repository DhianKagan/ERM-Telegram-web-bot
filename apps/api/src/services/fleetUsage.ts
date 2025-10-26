// Назначение: обновление показателей автопарка при закрытии задач.
// Основные модули: mongoose, db/models/fleet.
import { Types } from 'mongoose';

import { FleetVehicle } from '../db/models/fleet';

interface FleetUsagePayload {
  taskId: string;
  vehicleId: string;
  routeDistanceKm: number;
}

const round = (value: number): number =>
  Number(Number.isFinite(value) ? value.toFixed(3) : Number.NaN);

const toValidObjectId = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 && Types.ObjectId.isValid(trimmed) ? trimmed : null;
};

export async function updateFleetUsage({
  taskId,
  vehicleId,
  routeDistanceKm,
}: FleetUsagePayload): Promise<void> {
  if (!vehicleId) return;
  const normalizedId = toValidObjectId(vehicleId);
  if (!normalizedId) return;

  const distance = round(routeDistanceKm);
  if (!Number.isFinite(distance) || distance <= 0) {
    return;
  }

  const vehicle = await FleetVehicle.findById(normalizedId).exec();
  if (!vehicle) return;

  const odometerCurrent =
    typeof vehicle.odometerCurrent === 'number' && Number.isFinite(vehicle.odometerCurrent)
      ? vehicle.odometerCurrent
      : 0;
  const mileageTotal =
    typeof vehicle.mileageTotal === 'number' && Number.isFinite(vehicle.mileageTotal)
      ? vehicle.mileageTotal
      : 0;
  const fuelSpentTotal =
    typeof vehicle.fuelSpentTotal === 'number' && Number.isFinite(vehicle.fuelSpentTotal)
      ? vehicle.fuelSpentTotal
      : 0;
  const averageConsumption =
    typeof vehicle.fuelAverageConsumption === 'number' &&
    Number.isFinite(vehicle.fuelAverageConsumption)
      ? vehicle.fuelAverageConsumption
      : 0;

  vehicle.odometerCurrent = round(odometerCurrent + distance);
  vehicle.mileageTotal = round(mileageTotal + distance);
  const fuelIncrement = round(distance * averageConsumption);
  vehicle.fuelSpentTotal = round(fuelSpentTotal + fuelIncrement);

  try {
    await vehicle.save();
  } catch (error) {
    console.error(
      'Не удалось обновить показатели автопарка',
      {
        taskId,
        vehicleId: normalizedId,
        distance,
      },
      error,
    );
  }
}

