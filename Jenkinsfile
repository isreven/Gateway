#!groovy
/****************************************************************************
 ** Only change code below if you know what your are doing                 **
 ****************************************************************************/

@Library([
        'piper-lib',
        'piper-lib-os',
        'ci-tools-library'
]) _

node{
        checkout scm
        cloudPortalPiperPipeline([
                script: this,
                customDefaults: ['portal-cf-defaults.yml']
        ])
}
