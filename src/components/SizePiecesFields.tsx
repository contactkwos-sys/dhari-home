import type { DnoSize } from '../types'
import { SIZES, type SizeQtyMap } from '../types'

export function SizePiecesFields({
  values,
  onChange,
  idPrefix,
  hint,
}: {
  values: SizeQtyMap
  onChange: (size: DnoSize, value: string) => void
  idPrefix: string
  hint?: string
}) {
  return (
    <div className="col-span-2 space-y-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Pieces per size
        </p>
        <p className="text-xs text-muted">
          {hint ??
            'Same design — enter how many pieces for 5ft x 4ft and 7ft x 4ft.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {SIZES.map((size) => {
          const id = `${idPrefix}_${size.replace(/\s+/g, '_')}`
          return (
            <div className="field" key={size}>
              <label htmlFor={id}>{size}</label>
              <input
                id={id}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={values[size]}
                placeholder="0"
                onChange={(e) => onChange(size, e.target.value)}
                className="num"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
