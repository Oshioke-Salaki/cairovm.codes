import React, {
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { decode, encode } from '@kunigi/string-compression'
import cn from 'classnames'
import copy from 'copy-to-clipboard'
import { useRouter } from 'next/router'
import SCEditor from 'react-simple-code-editor'

import { CairoVMApiContext, CompilationState } from 'context/cairoVMApiContext'
import { Setting, SettingsContext } from 'context/settingsContext'

import { getAbsoluteURL } from 'util/browser'
import { isArgumentStringValid } from 'util/compiler'
import { codeHighlight, isEmpty, objToQueryString } from 'util/string'

import examples from 'components/Editor/examples'
import { Tracer } from 'components/Tracer'

import { ILogEntry } from '../../types'

import { ArgumentsHelperModal } from './ArgumentsHelperModal'
import Console from './Console'
import EditorControls from './EditorControls'
import Header from './Header'
import { InstructionsTable } from './InstructionsTable'
import { CodeType, IConsoleOutput, LogType } from './types'

type Props = {
  readOnly?: boolean
}

enum IConsoleTab {
  Console = 'debug-console',
  DebugInfo = 'output',
}

type SCEditorRef = {
  _input: HTMLTextAreaElement
} & RefObject<React.FC>

const cairoEditorHeight = 350
const runBarHeight = 52
const consoleHeight = 150

const Editor = ({ readOnly = false }: Props) => {
  const { settingsLoaded, getSetting } = useContext(SettingsContext)
  const router = useRouter()

  const {
    sierraCode,
    casmCode,
    isCompiling,
    compileCairoCode,
    cairoLangCompilerVersion,
    serializedOutput,
    tracerData,
    casmInstructions,
    activeCasmInstructionIndex,
    logs,
  } = useContext(CairoVMApiContext)

  const [cairoCode, setCairoCode] = useState('')
  const [codeType, setCodeType] = useState<string | undefined>()
  const [programArguments, setProgramArguments] = useState<string>('')
  const [output, setOutput] = useState<IConsoleOutput[]>([
    {
      type: LogType.Info,
      message: 'App initialised...',
    },
  ])
  const editorRef = useRef<SCEditorRef>()
  const [showArgumentsHelper, setShowArgumentsHelper] = useState(false)
  const [selectedConsoleTab, setSelectedConsoleTab] = useState<IConsoleTab>(
    IConsoleTab.DebugInfo,
  )

  const log = useCallback(
    (line: string, type = LogType.Info) => {
      // See https://blog.logrocket.com/a-guide-to-usestate-in-react-ecb9952e406c/
      setOutput((previous) => {
        const cloned = previous.map((x) => ({ ...x }))
        cloned.push({ type, message: line })
        return cloned
      })
    },
    [setOutput],
  )

  useEffect(() => {
    const query = router.query

    if ('codeType' in query && 'code' in query) {
      setCodeType(query.codeType as string)
      setCairoCode(JSON.parse('{"a":' + decode(query.code as string) + '}').a)
    } else {
      const initialCodeType: CodeType =
        getSetting(Setting.EditorCodeType) || CodeType.Cairo

      setCodeType(initialCodeType)
      setCairoCode(examples[initialCodeType][0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded && router.isReady])

  const handleLogs = (logs: ILogEntry[]) => {
    for (const logEntry of logs) {
      // TODO: make this cleaner
      let log_type
      if (logEntry.log_type == 'Error') {
        log_type = LogType.Error
      } else if (logEntry.log_type == 'Warn') {
        log_type = LogType.Warn
      } else {
        log_type = LogType.Info
      }

      log(logEntry.message, log_type)
    }
  }

  useEffect(() => {
    if (isCompiling === CompilationState.Compiling) {
      log('Compiling...')
    } else if (isCompiling === CompilationState.Compiled) {
      log('Compilation successful')
      handleLogs(logs)
      if (serializedOutput) {
        log(`Execution output: ${serializedOutput}`)
      }
    } else if (isCompiling === CompilationState.Error) {
      handleLogs(logs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompiling, log, serializedOutput, logs])

  const handleCairoCodeChange = (value: string) => {
    setCairoCode(value)
  }

  const highlightCode = (value: string) => {
    if (!codeType) {
      return value
    }

    let _codeType = codeType

    if (_codeType === CodeType.Sierra) {
      _codeType = CodeType.Cairo
    }

    if (_codeType === CodeType.CASM) {
      _codeType = 'bytecode'
    }

    return codeHighlight(value, _codeType)
      .value.split('\n')
      .map((line, i) => `<span className='line-number'>${i + 1}</span>${line}`)
      .join('\n')
  }

  const removeExtraWhitespaces = (value: string) => {
    const sanitizedValue = value.trim().replace(/\s+/g, ' ')
    return sanitizedValue
  }

  const handleProgramArgumentsUpdate = useCallback(
    (_programArguments: string) => {
      setProgramArguments(_programArguments)
    },
    [setProgramArguments],
  )

  const handleCompileRun = useCallback(() => {
    compileCairoCode(cairoCode, removeExtraWhitespaces(programArguments))
  }, [cairoCode, programArguments, compileCairoCode])

  const handleCopyPermalink = useCallback(() => {
    const params = {
      codeType,
      code: encodeURIComponent(encode(JSON.stringify(cairoCode))),
    }

    copy(`${getAbsoluteURL('/')}?${objToQueryString(params)}`)
    log('Link with current Cairo code copied to clipboard')
  }, [cairoCode, codeType, log])

  const areProgramArgumentsValid = useMemo(() => {
    const sanitizedArguments = removeExtraWhitespaces(programArguments)
    return isArgumentStringValid(sanitizedArguments)
  }, [programArguments])

  const isCompileDisabled = useMemo(() => {
    return isCompiling === CompilationState.Compiling || isEmpty(cairoCode)
  }, [isCompiling, cairoCode])

  const isBytecode = false

  return (
    <>
      <div className="bg-gray-100 dark:bg-black-700 rounded-lg">
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-1/2 flex flex-col">
            <div className="border-b border-gray-200 dark:border-black-500 flex items-center pl-6 pr-2 h-14 md:border-r">
              <Header
                codeType={codeType}
                onCodeTypeChange={({ value }) => setCodeType(value)}
              />
            </div>

            <div
              className="relative pane pane-light flex-grow overflow-auto md:border-r bg-gray-50 dark:bg-black-600 border-gray-200 dark:border-black-500"
              style={{ height: cairoEditorHeight }}
            >
              {codeType === CodeType.CASM ? (
                <InstructionsTable
                  instructions={casmInstructions}
                  activeIndex={activeCasmInstructionIndex}
                  height={cairoEditorHeight}
                />
              ) : (
                <SCEditor
                  // @ts-ignore: SCEditor is not TS-friendly
                  ref={editorRef}
                  value={
                    codeType === CodeType.Cairo
                      ? cairoCode
                      : codeType === CodeType.Sierra
                      ? sierraCode
                      : codeType === CodeType.CASM
                      ? casmCode
                      : ''
                  }
                  readOnly={readOnly}
                  onValueChange={handleCairoCodeChange}
                  highlight={highlightCode}
                  tabSize={4}
                  className={cn('code-editor', {
                    'with-numbers': !isBytecode,
                  })}
                />
              )}
            </div>
            <EditorControls
              isCompileDisabled={isCompileDisabled}
              programArguments={programArguments}
              areProgramArgumentsValid={areProgramArgumentsValid}
              onCopyPermalink={handleCopyPermalink}
              onProgramArgumentsUpdate={handleProgramArgumentsUpdate}
              onCompileRun={handleCompileRun}
              onShowArgumentsHelper={() => setShowArgumentsHelper(true)}
            />
          </div>

          <div className="flex flex-col w-full md:w-1/2">
            <div className="flex-grow bg-gray-50">
              <Tracer tracerData={tracerData} mainHeight={cairoEditorHeight} />
            </div>
            <div className="border-gray-200 border-t">
              <div className="px-4">
                <nav
                  className="-mb-px uppercase flex space-x-8"
                  aria-label="Tabs"
                >
                  <a
                    href="#"
                    className={`hover:text-gray-700 whitespace-nowrap border-b py-1 mt-2 mb-4 text-xs font-thin ${cn(
                      {
                        'border-indigo-600 text-gray-700':
                          selectedConsoleTab === IConsoleTab.DebugInfo,
                        'border-transparent text-gray-500':
                          selectedConsoleTab !== IConsoleTab.DebugInfo,
                      },
                    )}`}
                    onClick={() => setSelectedConsoleTab(IConsoleTab.DebugInfo)}
                  >
                    Debug Info
                  </a>
                  <a
                    href="#"
                    onClick={() => setSelectedConsoleTab(IConsoleTab.Console)}
                    className={`hover:text-gray-700 whitespace-nowrap border-b py-1 mt-2 mb-4 text-xs font-thin ${cn(
                      {
                        'border-indigo-600 text-gray-700':
                          selectedConsoleTab === IConsoleTab.Console,
                        'border-transparent text-gray-500':
                          selectedConsoleTab !== IConsoleTab.Console,
                      },
                    )}`}
                  >
                    Console
                  </a>
                </nav>
              </div>
              <div
                className="pane pane-light overflow-auto"
                style={{ height: consoleHeight }}
              >
                {selectedConsoleTab === IConsoleTab.Console && (
                  <Console output={output} />
                )}

                {selectedConsoleTab === IConsoleTab.DebugInfo && (
                  <div className="px-4 pb-4">
                    <dl className="text-2xs">
                      <div className="flex justify-between">
                        <div>
                          <dt className="mb-1 text-gray-500 dark:text-gray-400 font-medium uppercase">
                            Registers
                          </dt>
                          <dd className="font-mono mb-2 flex gap-1">
                            {/* TODO: make those buttons that move execution trace to the right place  */}
                            <div className="font-mono inline-block border px-2 py-1 mb-1 cursor-pointer rounded-sm break-all text-tiny border-gray-300 dark:border-gray-700 text-gray-500 hover:text-fuchsia-700 hover:border-fuchsia-700">
                              PC: {7}
                            </div>
                            <div className="font-mono inline-block border px-2 py-1 mb-1 rounded-sm break-all text-tiny border-gray-300 dark:border-gray-700 text-gray-500">
                              FP: 13
                            </div>
                            <div className="font-mono inline-block border px-2 py-1 mb-1 rounded-sm break-all text-tiny border-gray-300 dark:border-gray-700 text-gray-500">
                              AP: 13
                            </div>
                          </dd>
                        </div>
                        <div>
                          <dt className="mb-1 text-gray-500 dark:text-gray-400 font-medium uppercase">
                            Execution steps
                          </dt>
                          <dd className="font-mono mb-2">
                            <div className="font-mono inline-block border px-2 py-1 mb-1 rounded-sm break-all text-tiny border-gray-300 dark:border-gray-700 text-gray-500">
                              Current: 1, Total: 5
                            </div>
                          </dd>
                        </div>
                      </div>
                      <dt className="mb-1 text-gray-500 dark:text-gray-400 font-medium uppercase">
                        Call stack
                      </dt>
                      <dd className="font-mono mb-2">
                        <div className="font-mono inline-block border px-2 py-1 mb-1 rounded-sm w-full break-all text-tiny border-gray-300 dark:border-gray-700 text-gray-500">
                          FP: 7, Return PC: 12
                        </div>
                        <div
                          className="font-mono inline-block border px-2 py-1 mb-1 rounded-sm w-full break-all text-tiny border-gray-300 dark:border-gray-700 text-gray-500"
                          style={{ minHeight: 24 }}
                        >
                          FP: 9, Return PC: 8
                        </div>
                      </dd>
                    </dl>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row-reverse">
          <div className="w-full"></div>
        </div>

        <div className="rounded-b-lg py-2 px-4 border-t bg-gray-800 dark:bg-black-700 border-black-900/25 text-gray-400 dark:text-gray-600 text-xs">
          {cairoLangCompilerVersion !== ''
            ? `Cairo Compiler v${cairoLangCompilerVersion}`
            : ' '}
        </div>
      </div>
      <ArgumentsHelperModal
        showArgumentsHelper={showArgumentsHelper}
        setShowArgumentsHelper={setShowArgumentsHelper}
      />
    </>
  )
}

export default Editor
