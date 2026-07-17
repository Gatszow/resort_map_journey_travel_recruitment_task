import { describe, expect, it } from 'vitest'
import { parseGuests } from './resort.ts'

describe('parseGuests', () => {
  it('reads and trims a guest list', () => {
    expect(parseGuests('[{ "room": " 101 ", "guestName": " Alice Smith " }]')).toEqual([
      { room: '101', guestName: 'Alice Smith' },
    ])
  })

  it.each([
    ['not JSON at all', 'nonsense', /not valid json/i],
    ['a JSON object', '{ "room": "101" }', /must contain a json array/i],
    ['a guest without a room', '[{ "guestName": "Alice Smith" }]', /index 0 is missing a non-empty "room"/i],
    ['a guest with a blank name', '[{ "room": "101", "guestName": "  " }]', /index 0 is missing a non-empty "guestName"/i],
    ['a duplicated room', '[{"room":"101","guestName":"A"},{"room":"101","guestName":"B"}]', /room 101 more than once/i],
  ])('rejects %s', (_label, text, message) => {
    expect(() => parseGuests(text)).toThrow(message)
  })
})
