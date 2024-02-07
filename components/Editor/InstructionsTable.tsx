import { useEffect, useRef } from 'react'

import { IInstruction } from 'types'

export const InstructionsTable = ({
  instructions,
  activeIndexes,
  height,
}: {
  instructions: IInstruction[]
  activeIndexes: number[]
  height: number
}) => {
  useEffect(() => {
    if (
      tableRef.current &&
      focusRowRef.current &&
      focusRowRef.current.offsetTop
    ) {
      tableRef.current.scrollTop = focusRowRef.current.offsetTop - 58
    }
  }, [activeIndexes])

  const tableRef = useRef<HTMLDivElement>(null)
  const focusRowRef = useRef<HTMLTableRowElement>(null)

  return (
    <div
      ref={tableRef}
      className="overflow-auto pane pane-light relative bg-gray-50 dark:bg-black-600 border-gray-200 dark:border-black-500"
      style={{ height }}
    >
      <table className="w-full font-mono text-tiny">
        <tbody>
          {instructions.map((instruction, index) => {
            const isActive = activeIndexes.includes(index)
            return (
              <tr
                ref={activeIndexes[0] === index ? focusRowRef : undefined}
                key={index}
                className={`border-b border-gray-200 dark:border-black-500 ${
                  isActive
                    ? 'text-gray-900 dark:text-gray-200'
                    : 'text-gray-400 dark:text-gray-600'
                } `}
              >
                <td className={`pl-6 pr-1 px-2 whitespace-nowrap w-[1%]`}>
                  {index + 1}
                </td>
                <td className="py-1 px-2 max-w-40 break-words">
                  {instruction.name.split('\n').map((line, i) => (
                    <span key={i}>
                      {i !== 0 ? <br /> : <></>}
                      {line}
                    </span>
                  ))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
