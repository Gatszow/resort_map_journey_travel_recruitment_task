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
  // Count first — with no images matched, "none are broken" would be vacuously true.
  const sprites = page.locator('.map img, .legend img')
  expect(await sprites.count()).toBeGreaterThan(47)

  const broken = await sprites.evaluateAll((images) =>
    images.filter((image) => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0).length,
  )
  expect(broken).toBe(0)

  const pool = page.getByTestId('pool-overlay').locator('img')
  await expect(pool).toBeVisible()
  // Guards paint order: the water tiles are positioned, so a static overlay hides behind them.
  expect(await pool.evaluate((image) => getComputedStyle(image.parentElement!).position)).not.toBe('static')

  await page.getByTestId('resort-map').screenshot({ path: 'screenshot.png' })
})

test('puts every cabana in the cell its coordinates name', async ({ page }) => {
  await page.goto('/')

  const placed = await page.locator('[data-testid^="cabana-"]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const [x, y] = node.getAttribute('data-testid')!.replace('cabana-', '').split(',').map(Number)
      const box = node.getBoundingClientRect()
      return { x, y, left: Math.round(box.left), top: Math.round(box.top) }
    }),
  )
  expect(placed).toHaveLength(47)

  // Cabanas sharing a map column must share a screen edge, and the edges must climb
  // with the coordinate. Auto-placed tiles flowing around the pool break this at once.
  const lefts = new Map<number, number>()
  const tops = new Map<number, number>()
  for (const tile of placed) {
    if (lefts.has(tile.x)) expect(tile.left, `column ${tile.x}`).toBe(lefts.get(tile.x))
    else lefts.set(tile.x, tile.left)

    if (tops.has(tile.y)) expect(tile.top, `row ${tile.y}`).toBe(tops.get(tile.y))
    else tops.set(tile.y, tile.top)
  }

  const ascending = (m: Map<number, number>) =>
    [...m.keys()].sort((a, b) => a - b).map((k) => m.get(k)!)
  expect(ascending(lefts)).toEqual([...ascending(lefts)].sort((a, b) => a - b))
  expect(ascending(tops)).toEqual([...ascending(tops)].sort((a, b) => a - b))
})

test('draws a booked cabana differently from a free one', async ({ page, request }) => {
  // The brief asks for a distinct visual style, which no DOM attribute can prove.
  // Shoot the same cabana before and after: same cell, same parchment behind it, so
  // any difference in the pixels is the booked styling and nothing else.
  await page.goto('/')
  await expect(cabana(page, '13,11')).toHaveAttribute('data-booked', 'false')
  const free = await cabana(page, '13,11').screenshot()

  await request.post('/api/bookings', { data: { cabanaId: '13,11', room: '105', guestName: 'Eva Martinez' } })
  await page.reload()
  await expect(cabana(page, '13,11')).toHaveAttribute('data-booked', 'true')
  const booked = await cabana(page, '13,11').screenshot()

  expect(Buffer.compare(booked, free), 'a booked cabana renders identically to a free one').not.toBe(0)
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

  await page.getByLabel('Room number').fill('105')
  await page.getByLabel('Guest name').fill('Eva Martinez')
  await page.getByRole('button', { name: 'Book cabana' }).click()

  // The map refreshes and the form gives way, rather than looping on the same 409.
  await expect(page.getByTestId('cabana-unavailable')).toBeVisible()
  await expect(page.getByTestId('booking-form')).toBeHidden()
  await expect(cabana(page, '10,11')).toHaveAttribute('data-booked', 'true')
})

test('confirms the booking even when refreshing the map afterwards fails', async ({ page }) => {
  await page.goto('/')
  await cabana(page, '11,11').click()
  await page.getByLabel('Room number').fill('106')
  await page.getByLabel('Guest name').fill('Frank Wilson')

  // The booking itself goes through; only the refresh that follows it is broken.
  await page.route('**/api/map', (route) => route.abort())
  await page.getByRole('button', { name: 'Book cabana' }).click()

  await expect(page.getByTestId('booking-confirmation')).toContainText('11,11')
  await expect(page.getByTestId('booking-form')).toBeHidden()
})

test('locks the submit button while the booking is in flight', async ({ page }) => {
  await page.goto('/')
  await cabana(page, '15,11').click()
  await page.getByLabel('Room number').fill('107')
  await page.getByLabel('Guest name').fill('Grace Lee')

  // Hold the request open so the in-flight state is observable.
  let release = () => {}
  await page.route('**/api/bookings', async (route) => {
    await new Promise<void>((resolve) => (release = resolve))
    await route.continue()
  })

  const submit = page.getByRole('button', { name: /Book cabana|Booking/ })
  await submit.click()
  await expect(submit).toBeDisabled()

  release()
  await expect(page.getByTestId('booking-confirmation')).toBeVisible()
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
