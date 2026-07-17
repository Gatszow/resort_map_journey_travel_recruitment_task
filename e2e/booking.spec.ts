import { expect, test, type Page } from '@playwright/test'

// The server keeps bookings in memory and every spec shares it, so each spec below
// books a different cabana with a different room.
const cabana = (page: Page, id: string) => page.getByTestId(`cabana-${id}`)

test('draws the resort map from the API', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')

  await expect(page.getByTestId('resort-map')).toBeVisible()
  await expect(page.locator('[data-testid^="cabana-"]')).toHaveCount(47)
  await expect(page.getByTestId('legend')).toBeVisible()
  expect(errors).toEqual([])

  // Every sprite must actually decode: a typo in a filename still lays out fine.
  const broken = await page.locator('.map img, .legend img').evaluateAll((images) =>
    images.filter((image) => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0).length,
  )
  expect(broken).toBe(0)

  const pool = page.getByTestId('pool-overlay').locator('img')
  await expect(pool).toBeVisible()
  // Guards paint order: the water tiles are positioned, so a static overlay hides behind them.
  expect(await pool.evaluate((image) => getComputedStyle(image.parentElement!).position)).not.toBe('static')

  await page.getByTestId('resort-map').screenshot({ path: 'screenshot.png' })
})

test('books a free cabana and shows it as taken on the map', async ({ page }) => {
  await page.goto('/')
  await cabana(page, '5,11').click()

  await expect(page.getByTestId('booking-form')).toBeVisible()
  await page.getByLabel('Room number').fill('101')
  await page.getByLabel('Guest name').fill('Alice Smith')
  await page.getByRole('button', { name: 'Book cabana' }).click()

  await expect(page.getByTestId('booking-confirmation')).toContainText('5,11')
  await expect(cabana(page, '5,11')).toHaveAttribute('data-booked', 'true')

  await page.getByRole('button', { name: 'Back to the map' }).click()
  await expect(page.getByTestId('legend')).toBeVisible()
  await expect(cabana(page, '5,11')).toHaveAccessibleName(/booked/)
})

test('keeps the booking after a reload, because the map comes from the server', async ({ page }) => {
  await page.goto('/')
  await cabana(page, '6,11').click()
  await page.getByLabel('Room number').fill('102')
  await page.getByLabel('Guest name').fill('Bob Jones')
  await page.getByRole('button', { name: 'Book cabana' }).click()
  await expect(page.getByTestId('booking-confirmation')).toBeVisible()

  await page.reload()

  await expect(cabana(page, '6,11')).toHaveAttribute('data-booked', 'true')
  await expect(cabana(page, '7,11')).toHaveAttribute('data-booked', 'false')
})

test('explains that a booked cabana is not available, instead of offering the form', async ({ page, request }) => {
  await request.post('/api/bookings', { data: { cabanaId: '8,11', room: '103', guestName: 'Carol White' } })

  await page.goto('/')
  await cabana(page, '8,11').click()

  await expect(page.getByTestId('cabana-unavailable')).toContainText('already booked')
  await expect(page.getByTestId('booking-form')).toBeHidden()
})

test('recovers when someone else takes the cabana while the form is open', async ({ page, request }) => {
  await page.goto('/')
  await cabana(page, '10,11').click()
  await expect(page.getByTestId('booking-form')).toBeVisible()

  // Another guest books it behind this page's back, so the open form is now stale.
  await request.post('/api/bookings', { data: { cabanaId: '10,11', room: '104', guestName: 'David Brown' } })

  await page.getByLabel('Room number').fill('103')
  await page.getByLabel('Guest name').fill('Carol White')
  await page.getByRole('button', { name: 'Book cabana' }).click()

  // The map refreshes and the form gives way, rather than looping on the same 409.
  await expect(page.getByTestId('cabana-unavailable')).toBeVisible()
  await expect(page.getByTestId('booking-form')).toBeHidden()
  await expect(cabana(page, '10,11')).toHaveAttribute('data-booked', 'true')
})

test('rejects a name that does not match the room and keeps the form open', async ({ page }) => {
  await page.goto('/')
  await cabana(page, '9,11').click()
  await page.getByLabel('Room number').fill('104')
  await page.getByLabel('Guest name').fill('Not A Guest')
  await page.getByRole('button', { name: 'Book cabana' }).click()

  await expect(page.getByTestId('booking-error')).toContainText('could not find a guest')
  await expect(page.getByTestId('booking-form')).toBeVisible()
  await expect(cabana(page, '9,11')).toHaveAttribute('data-booked', 'false')
})
