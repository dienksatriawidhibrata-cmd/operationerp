export const QUALITY_CONTROL_ITEMS = [
  'Bagi Espresso',
  'Bagi Golden',
  'Adonan Kopi Susu',
  'Adonan Matcha',
  'Adonan Chocolate',
  'Freshmilk',
  'Creamer Gold',
  'Adonan/Based Black Tea',
  'Adonan/Based Rosella Tea',
  'Adonan/Based Bunga Telang',
  'Adonan Kekayaan',
  'Oatmilk',
  'Nasi',
  'Ayam',
  'Beef',
  'Sambal Matah',
  'Sambal Goang',
  'Saus Nashville',
  'Salad',
  'Cireng',
  'Tahu Cibuntu',
  'Tahu Walik',
  'Acar',
  'Telur Ramen',
]

export function createQualityControlRows(existingItems = []) {
  const existingMap = new Map(
    (existingItems || []).map((item) => [item.item, item])
  )

  return QUALITY_CONTROL_ITEMS.map((item) => {
    const current = existingMap.get(item) || {}
    return {
      item,
      stock: current.stock || '',
      productionDate: current.productionDate || '',
      notes: current.notes || '',
    }
  })
}
