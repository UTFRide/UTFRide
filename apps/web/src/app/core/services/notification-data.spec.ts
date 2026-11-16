import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';
import { Ride } from '../models/ride.model';
import { NotificationData } from './notification-data';

describe('NotificationData', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('cria um aviso interno em /notifications para cada destinatário único da oferta cancelada', async () => {
    const notificationData = TestBed.inject(NotificationData);
    const http = TestBed.inject(HttpTestingController);

    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 3,
      availableSeats: 1,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const resultPromise = firstValueFrom(
      notificationData.createCancellationNotifications$(ride, [
        'passenger-1',
        'passenger-2',
        'passenger-1',
      ]),
    );

    const requests = http.match(
      (req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'POST',
    );
    expect(requests.length).toBe(2);

    const createdNotifications: Notification[] = requests.map((req, index) => {
      const body = req.request.body as Omit<Notification, 'id'>;
      expect(body.rideId).toBe('ride-1');
      expect(body.recipientId).toBe(index === 0 ? 'passenger-1' : 'passenger-2');
      expect(body.message).toContain('Batel');
      expect(body.message).toContain('UTFPR Neoville');
      expect(body.message.toLowerCase()).toContain('cancelad');
      expect(body.createdAt).toEqual(expect.any(String));

      const saved: Notification = { id: `notif-${index + 1}`, ...body };
      req.flush(saved);
      return saved;
    });

    const result = await resultPromise;
    expect(result).toEqual(createdNotifications);
    expect(notificationData.notifications()).toEqual(createdNotifications);
    http.verify();
  });

  it('não envia requisições quando a lista de destinatários está vazia', async () => {
    const notificationData = TestBed.inject(NotificationData);
    const http = TestBed.inject(HttpTestingController);

    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 3,
      availableSeats: 3,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const result = await firstValueFrom(
      notificationData.createCancellationNotifications$(ride, []),
    );

    expect(result).toEqual([]);
    http.expectNone(`${environment.apiUrl}/notifications`);
    http.verify();
  });
});
