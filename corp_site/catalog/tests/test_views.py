from django.test import TestCase
from django.urls import reverse

from catalog.models import Category, ContactRequest


class IndexViewTest(TestCase):
    def test_index_page_loads(self):
        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'СпецМонтаж')


class EquipmentListViewTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cat = Category.objects.create(
            name='Видеонаблюдение',
            slug='svn',
            short_name='СВН',
            description='Описание СВН',
            icon='bi-camera-video',
            order=1,
        )

    def test_equipment_list_loads(self):
        response = self.client.get(reverse('equipment_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Видеонаблюдение')

    def test_equipment_list_empty(self):
        Category.objects.all().delete()
        response = self.client.get(reverse('equipment_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Каталог оборудования пока пуст')


class EquipmentDetailViewTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cat = Category.objects.create(
            name='СКУД',
            slug='skud',
            short_name='СКУД',
            description='Описание',
            icon='bi-fingerprint',
            order=1,
        )

    def test_detail_loads(self):
        response = self.client.get(
            reverse('equipment_detail', args=[self.cat.slug])
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'СКУД')

    def test_detail_404(self):
        response = self.client.get(
            reverse('equipment_detail', args=['nonexistent'])
        )
        self.assertEqual(response.status_code, 404)


class ServicesViewTest(TestCase):
    def test_services_page_loads(self):
        response = self.client.get(reverse('services'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Проектирование')
        self.assertContains(response, 'Монтаж')
        self.assertContains(response, 'Обслуживание')


class ContactsViewTest(TestCase):
    def test_contacts_page_loads(self):
        response = self.client.get(reverse('contacts'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Форма обратной связи')

    def test_submit_valid_form(self):
        response = self.client.post(reverse('contacts'), {
            'name': 'Иван Иванов',
            'email': 'ivan@example.com',
            'phone': '+7 999 123 4567',
            'message': 'Нужна консультация по СКУД',
        })
        self.assertRedirects(response, reverse('contact_success'))
        self.assertEqual(ContactRequest.objects.count(), 1)
        req = ContactRequest.objects.first()
        self.assertEqual(req.name, 'Иван Иванов')

    def test_submit_invalid_form(self):
        response = self.client.post(reverse('contacts'), {
            'name': '',
            'email': 'invalid',
            'message': '',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(ContactRequest.objects.count(), 0)


class ContactSuccessViewTest(TestCase):
    def test_success_page_loads(self):
        response = self.client.get(reverse('contact_success'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Заявка успешно отправлена')
