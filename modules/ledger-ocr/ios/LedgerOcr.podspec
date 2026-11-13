Pod::Spec.new do |s|
  s.name           = 'LedgerOcr'
  s.version        = '1.0.0'
  s.summary        = 'Vision framework OCR for the Ledger app'
  s.description    = 'Local text recognition on device, no network, using Apple Vision.'
  s.author         = 'ledger'
  s.homepage       = 'https://github.com/sad676-cell/daily-ledger'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/sad676-cell/daily-ledger.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
